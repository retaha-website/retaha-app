// POST /api/admin/breakfast/eve-allergens
// Lässt Eve für alle Frühstücks-Items des Hotels die EU-Hauptallergene erkennen
// und speichert sie direkt in der DB.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { EU_ALLERGENS } from '@retaha/db';
import Anthropic from '@anthropic-ai/sdk';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const ALLERGEN_KEYS = EU_ALLERGENS.map(a => a.key as string);

// Normalisierte Schreibweisen → interner Key
const LABEL_TO_KEY: Record<string, string> = {};
for (const a of EU_ALLERGENS) {
  LABEL_TO_KEY[a.key] = a.key;
  LABEL_TO_KEY[a.label_de.toLowerCase()] = a.key;
  LABEL_TO_KEY[a.label_en.toLowerCase()] = a.key;
}
// Zusätzliche Aliase
const EXTRA: Record<string, string> = {
  'gluten': 'gluten', 'weizen': 'gluten', 'dinkel': 'gluten', 'roggen': 'gluten',
  'gerste': 'gluten', 'hafer': 'gluten', 'laktose': 'milk', 'käse': 'milk',
  'butter': 'milk', 'sahne': 'milk', 'joghurt': 'milk', 'nüsse': 'nuts',
  'mandeln': 'nuts', 'mandel': 'nuts', 'haselnüsse': 'nuts', 'haselnuss': 'nuts',
  'walnüsse': 'nuts', 'walnuss': 'nuts', 'cashews': 'nuts', 'erdnuss': 'peanuts',
  'sulfit': 'sulfites', 'schwefeldioxid': 'sulfites', 'sulphites': 'sulfites',
  'sulphur dioxide': 'sulfites', 'ei': 'eggs',
};
Object.assign(LABEL_TO_KEY, EXTRA);

function parseAllergenKeys(list: string[]): string[] {
  const result = new Set<string>();
  for (const raw of list) {
    const norm = raw.trim().toLowerCase();
    const key = LABEL_TO_KEY[norm];
    if (key && ALLERGEN_KEYS.includes(key)) result.add(key);
  }
  return [...result];
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'ai_not_configured', message: 'KI nicht konfiguriert.' }, 500);

  const supabase = createSupabaseServiceRoleInstance();
  const { data: rows, error: fetchErr } = await supabase
    .from('breakfast_items')
    .select('id, name_de, description_de')
    .eq('hotel_id', (hotel as any).id)
    .order('display_order');

  if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: false, error: 'no_items', message: 'Keine Speisen vorhanden.' }, 400);

  const itemsForPrompt = rows.map(r => ({
    id: r.id,
    name: r.name_de || '',
    desc: r.description_de || '',
  }));

  const systemPrompt = `Du bist Lebensmittelexperte (LMIV Art. 9). Analysiere Frühstücksartikel auf die 14 EU-Hauptallergene.
Antworte NUR mit einem JSON-Array. Jedes Element hat "id" (String) und "allergens" (Array der englischen Key-Strings).
Mögliche Keys: ${ALLERGEN_KEYS.join(', ')}.
Leere allergens-Arrays sind erlaubt. Gib KEIN Markdown, KEINE Erklärungen — nur das JSON-Array.`;

  const userMsg = JSON.stringify(itemsForPrompt.map(i => ({
    id: i.id,
    name: i.name,
    ...(i.desc ? { description: i.desc } : {}),
  })));

  let parsed: Array<{ id: string; allergens: string[] }>;
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    });
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('not an array');
  } catch (err: any) {
    console.error('[eve-allergens] parse error', err?.message);
    return json({ ok: false, error: 'ai_parse_error', message: 'Eve-Antwort konnte nicht verarbeitet werden.' }, 500);
  }

  // Upsert allergen flags per item
  const updates: Array<Record<string, unknown>> = [];
  for (const entry of parsed) {
    if (!entry.id || !Array.isArray(entry.allergens)) continue;
    const allergenFlags: Record<string, boolean> = {};
    for (const k of ALLERGEN_KEYS) allergenFlags[`contains_${k}`] = false;
    for (const k of parseAllergenKeys(entry.allergens)) allergenFlags[`contains_${k}`] = true;
    updates.push({ id: entry.id, ...allergenFlags, updated_at: new Date().toISOString() });
  }

  if (updates.length === 0) return json({ ok: false, error: 'no_updates' }, 400);

  const { error: upErr } = await supabase
    .from('breakfast_items')
    .upsert(updates, { onConflict: 'id' });

  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  // Reload items to return fresh state
  const { data: fresh } = await supabase
    .from('breakfast_items')
    .select('*')
    .eq('hotel_id', (hotel as any).id)
    .order('display_order');

  return json({ ok: true, updated: updates.length, items: fresh ?? [] });
};
