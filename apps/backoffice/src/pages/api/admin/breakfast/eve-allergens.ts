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
const EXTRA: Record<string, string> = {
  'weizen': 'gluten', 'dinkel': 'gluten', 'roggen': 'gluten', 'gerste': 'gluten', 'hafer': 'gluten',
  'laktose': 'milk', 'käse': 'milk', 'butter': 'milk', 'sahne': 'milk', 'joghurt': 'milk',
  'nüsse': 'nuts', 'mandeln': 'nuts', 'mandel': 'nuts', 'haselnüsse': 'nuts', 'haselnuss': 'nuts',
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

function extractJson(raw: string): string {
  // Strip markdown fences
  const stripped = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  // Find outermost JSON array
  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);
  return stripped;
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized', message: 'Nicht autorisiert.' }, 401);

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'ai_not_configured', message: 'KI nicht konfiguriert.' }, 500);

  const supabase = createSupabaseServiceRoleInstance();
  const { data: rows, error: fetchErr } = await supabase
    .from('breakfast_items')
    .select('id, name_de, description_de')
    .eq('hotel_id', (hotel as any).id)
    .order('display_order');

  if (fetchErr) {
    console.error('[eve-allergens] fetch error', fetchErr.message);
    return json({ ok: false, error: fetchErr.code, message: fetchErr.message }, 500);
  }
  if (!rows || rows.length === 0) {
    return json({ ok: false, error: 'no_items', message: 'Keine Speisen vorhanden.' }, 400);
  }

  const systemPrompt = `Du bist Lebensmittelexperte (LMIV Art. 9). Analysiere Frühstücksartikel auf die 14 EU-Hauptallergene.
Antworte NUR mit einem JSON-Array ohne Markdown. Jedes Element: {"id":"<id>","allergens":["<key>",...]}
Mögliche allergen-Keys: ${ALLERGEN_KEYS.join(', ')}.
Leere allergens-Arrays sind erlaubt.`;

  const userMsg = JSON.stringify(rows.map(r => ({
    id: r.id,
    name: r.name_de || '',
    ...(r.description_de ? { description: r.description_de } : {}),
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
    console.log('[eve-allergens] raw response:', raw.slice(0, 300));
    parsed = JSON.parse(extractJson(raw));
    if (!Array.isArray(parsed)) throw new Error('response is not an array');
  } catch (err: any) {
    console.error('[eve-allergens] parse error:', err?.message);
    return json({ ok: false, error: 'ai_parse_error', message: 'Eve-Antwort konnte nicht verarbeitet werden: ' + (err?.message ?? '') }, 500);
  }

  // Update each item's allergen flags via .update() (no hotel_id required in payload)
  const now = new Date().toISOString();
  const updateResults = await Promise.all(
    parsed
      .filter(entry => entry.id && Array.isArray(entry.allergens))
      .map(entry => {
        const flags: Record<string, boolean> = {};
        for (const k of ALLERGEN_KEYS) flags[`contains_${k}`] = false;
        for (const k of parseAllergenKeys(entry.allergens)) flags[`contains_${k}`] = true;
        return supabase
          .from('breakfast_items')
          .update({ ...flags, updated_at: now })
          .eq('id', entry.id)
          .eq('hotel_id', (hotel as any).id);
      })
  );

  const firstErr = updateResults.find(r => r.error);
  if (firstErr?.error) {
    console.error('[eve-allergens] update error:', firstErr.error.message);
    return json({ ok: false, error: firstErr.error.code, message: firstErr.error.message }, 500);
  }

  // Reload items to return fresh state
  const { data: fresh } = await supabase
    .from('breakfast_items')
    .select('*')
    .eq('hotel_id', (hotel as any).id)
    .order('display_order');

  return json({ ok: true, updated: updateResults.length, items: fresh ?? [] });
};
