// POST /api/admin/eve/generate-field
// Generiert Plaintext für ein strukturiertes Wissens-Feld (Hausregeln, Anfahrt)
// via Anthropic Haiku im Kontext des Hotels.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import Anthropic from '@anthropic-ai/sdk';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const FIELD_PROMPTS: Record<string, string> = {
  rules: `Du bist ein Hotel-Assistent. Schreibe prägnante Hausregeln für das Hotel auf Deutsch.
Antworte NUR mit dem reinen Text der Hausregeln — kein JSON, kein Markdown, keine Erklärungen.
Stil: klar, freundlich-bestimmt, kurze Sätze. Maximal 120 Wörter.
Nutze den Hinweis des Nutzers als Basis, ergänze typische Hotelregeln sinnvoll.`,

  directions: `Du bist ein Hotel-Assistent. Schreibe eine prägnante Anfahrtsbeschreibung für das Hotel auf Deutsch.
Antworte NUR mit dem reinen Text der Anfahrt — kein JSON, kein Markdown, keine Erklärungen.
Stil: klar, praktisch, strukturiert (z.B. nach Verkehrsmittel). Maximal 120 Wörter.
Nutze den Hinweis des Nutzers als Basis, ergänze typische Anfahrtsinformationen sinnvoll.`,

  checkout_note: `Du bist ein Hotel-Assistent. Schreibe einen kurzen, freundlichen Checkout-Hinweis für Gäste auf Deutsch.
Antworte NUR mit dem reinen Text des Hinweises — kein JSON, kein Markdown, keine Erklärungen.
Stil: freundlich, klar, praktisch. Maximal 80 Wörter.
Typische Inhalte: Schlüsselrückgabe, Late-Checkout-Möglichkeit, Minibar, Gepäckaufbewahrung.
Nutze den Hinweis des Nutzers als Basis.`,
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { prompt?: string; field?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const prompt = body.prompt?.toString().trim() ?? '';
  const field = body.field?.toString().trim() ?? '';

  if (!prompt || prompt.length < 3) return json({ ok: false, error: 'prompt_too_short', message: 'Bitte kurz beschreiben, was Eve wissen soll.' }, 400);
  if (prompt.length > 600) return json({ ok: false, error: 'prompt_too_long', message: 'Hinweis zu lang (max. 600 Zeichen).' }, 400);
  if (!FIELD_PROMPTS[field]) return json({ ok: false, error: 'unknown_field' }, 400);

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'ai_not_configured', message: 'KI nicht konfiguriert.' }, 500);

  const sb = createSupabaseServiceRoleInstance();
  const { data: h } = await sb.from('hotels').select('name, website').eq('id', (hotel as any).id).maybeSingle();
  const hotelName = (h as any)?.name ?? (hotel as any).name ?? 'Hotel';
  const hotelWebsite = (h as any)?.website ?? '';

  const systemPrompt = `${FIELD_PROMPTS[field]}
Hotelname: ${hotelName}${hotelWebsite ? `\nWebsite: ${hotelWebsite}` : ''}`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    if (!text) return json({ ok: false, error: 'ai_empty', message: 'Eve hat keinen Text generiert.' }, 500);
    return json({ ok: true, text });
  } catch (err: any) {
    console.error('[eve/generate-field]', err?.message);
    return json({ ok: false, error: 'ai_error', message: 'Fehler bei der KI-Generierung.' }, 500);
  }
};
