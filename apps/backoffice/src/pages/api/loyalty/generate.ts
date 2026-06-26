import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import Anthropic from '@anthropic-ai/sdk';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const TOOL = {
  name: 'loyalty_program',
  description: 'Vollständiges Loyalty-Programm für ein Hotel auf Deutsch',
  input_schema: {
    type: 'object' as const,
    properties: {
      points_per_night: { type: 'number', description: 'Punkte pro Nacht (5–25, je nach Hotel-Kategorie)' },
      tiers: {
        type: 'array',
        description: 'Genau 3 Status-Stufen, aufsteigend nach Schwellenwert',
        items: {
          type: 'object',
          properties: {
            key:              { type: 'string', description: 'Kleinbuchstaben-Slug, z.B. "bronze"' },
            name:             { type: 'string', description: 'Anzeigename, z.B. "Bronze"' },
            threshold_points: { type: 'number', description: 'Erste Stufe immer 0' },
            benefits: {
              type: 'array',
              description: '2–4 Vorteile für diese Stufe',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Kurzer Vorteilsname (max 60 Zeichen)' },
                  desc:  { type: 'string', description: 'Optionale kurze Beschreibung (max 80 Zeichen, oder leer)' },
                },
                required: ['title', 'desc'],
              },
            },
          },
          required: ['key', 'name', 'threshold_points', 'benefits'],
        },
      },
      rewards: {
        type: 'array',
        description: '3–4 einlösbare Prämien',
        items: {
          type: 'object',
          properties: {
            id:           { type: 'string', description: 'Slug, z.B. "welcome_drink"' },
            title:        { type: 'string', description: 'Prämienname (max 80 Zeichen)' },
            desc:         { type: 'string', description: 'Kurzbeschreibung (max 120 Zeichen)' },
            cost_points:  { type: 'number', description: 'Einlösekosten in Punkten' },
            active:       { type: 'boolean', description: 'true' },
          },
          required: ['id', 'title', 'desc', 'cost_points', 'active'],
        },
      },
    },
    required: ['points_per_night', 'tiers', 'rewards'],
  },
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { brief?: string; section?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const brief = String(body.brief ?? '').trim().slice(0, 400);
  if (!brief) return json({ ok: false, error: 'missing_brief' }, 400);

  const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

  const prompt = `Du bist Experte für Hotelier-Treueprogramme.

Hotel: ${hotel.name}
Beschreibung: ${brief}

Erstelle ein passendes Loyalty-Programm. Alle Texte auf Deutsch.
Punkte/Nacht passend zur Kategorie (Budget → 5–8, Mittelklasse → 10–15, 4-Sterne → 15–20, Luxus → 20–25).
Stufen-Schwellen realistisch: 0 / ~100–200 / ~300–600.
Prämien kosteneffizient: günstigste ~50 Pkt, teuerste ~250–500 Pkt.`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'loyalty_program' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = msg.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') return json({ ok: false, error: 'no_output' }, 500);

    return json({ ok: true, ...(toolBlock.input as object) });
  } catch (e) {
    console.error('[loyalty/generate]', e);
    return json({ ok: false, error: 'generation_failed' }, 500);
  }
};
