import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import Anthropic from '@anthropic-ai/sdk';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const SET_TOOL = {
  name: 'action_card_set',
  description: 'Komplettes Set von 4–5 Marketing-Action-Cards für die Gäste-App eines Hotels',
  input_schema: {
    type: 'object' as const,
    properties: {
      cards: {
        type: 'array',
        description: '4–5 Action-Cards, absteigend nach Relevanz',
        items: {
          type: 'object',
          properties: {
            card_type:     { type: 'string', enum: ['internal_action', 'external_link', 'info', 'phone', 'email'] },
            action_target: { type: 'string', description: 'Für internal_action: open_breakfast / open_service / open_eve / open_places / open_wifi. Für external_link: URL. Für phone: Nummer. Für email: Adresse. Für info: leer.' },
            card_class:    { type: 'string', enum: ['rec-anthrazit', 'rec-pink', 'rec-white'], description: 'rec-anthrazit = dunkel, rec-pink = Statement, rec-white = hell' },
            eyebrow:       { type: 'string', description: 'Kurze Oberschrift, max 30 Zeichen, z.B. "Täglich bis 10:30"' },
            title:         { type: 'string', description: 'Haupttitel, max 40 Zeichen, prägnant und aktionsorientiert' },
            subtitle:      { type: 'string', description: 'Kurzer Teaser, max 80 Zeichen, optional' },
            cta:           { type: 'string', description: 'Button-Text, max 25 Zeichen, z.B. "Jetzt buchen"' },
          },
          required: ['card_type', 'action_target', 'card_class', 'title'],
        },
      },
    },
    required: ['cards'],
  },
};

const CARD_TOOL = {
  name: 'action_card_text',
  description: 'Texte für eine einzelne Marketing-Action-Card',
  input_schema: {
    type: 'object' as const,
    properties: {
      eyebrow:  { type: 'string', description: 'Kurze Oberschrift, max 30 Zeichen' },
      title:    { type: 'string', description: 'Haupttitel, max 40 Zeichen' },
      subtitle: { type: 'string', description: 'Teaser, max 80 Zeichen' },
      cta:      { type: 'string', description: 'Button-Text, max 25 Zeichen' },
    },
    required: ['title'],
  },
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { mode?: string; brief?: string; card_type?: string; action_target?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const mode = body.mode === 'card' ? 'card' : 'set';
  const brief = String(body.brief ?? '').trim().slice(0, 400);
  if (!brief) return json({ ok: false, error: 'missing_brief' }, 400);

  const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

  if (mode === 'set') {
    const prompt = `Du bist Experte für Hotel-Marketing und Gäste-Apps.

Hotel: ${hotel.name}
Beschreibung: ${brief}

Erstelle ein Set von 4–5 Marketing-Action-Cards für die Gäste-App. Alle Texte auf Deutsch.
Die Karten sollen Gäste zu buchbaren Leistungen, Extras und Erlebnissen führen.
Nutze internal_actions für in-App-Module (open_breakfast, open_service, open_eve, open_places, open_wifi).
Erste Karte am wichtigsten (z.B. Upsell oder Direktbuchung), letzte am unwichtigsten.
Sei konkret, aktionsorientiert und hotelbezogen — kein generisches Marketing-Sprech.`;

    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [SET_TOOL],
        tool_choice: { type: 'tool', name: 'action_card_set' },
        messages: [{ role: 'user', content: prompt }],
      });
      const toolBlock = msg.content.find(b => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') return json({ ok: false, error: 'no_output' }, 500);
      return json({ ok: true, ...(toolBlock.input as object) });
    } catch (e) {
      console.error('[action-cards/generate set]', e);
      return json({ ok: false, error: 'generation_failed' }, 500);
    }
  } else {
    const cardType = String(body.card_type ?? 'info');
    const actionTarget = String(body.action_target ?? '');
    const prompt = `Du bist Experte für Hotel-Marketing und Gäste-Apps.

Hotel: ${hotel.name}
Beschreibung: ${brief}
Karten-Typ: ${cardType}${actionTarget ? `\nAction: ${actionTarget}` : ''}

Schreibe prägnante Texte auf Deutsch für diese eine Action-Card.
Eyebrow (30 Zeichen), Titel (40 Zeichen), Untertitel (80 Zeichen), CTA-Button (25 Zeichen).
Konkret, aktionsorientiert, hotelbezogen.`;

    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        tools: [CARD_TOOL],
        tool_choice: { type: 'tool', name: 'action_card_text' },
        messages: [{ role: 'user', content: prompt }],
      });
      const toolBlock = msg.content.find(b => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') return json({ ok: false, error: 'no_output' }, 500);
      return json({ ok: true, ...(toolBlock.input as object) });
    } catch (e) {
      console.error('[action-cards/generate card]', e);
      return json({ ok: false, error: 'generation_failed' }, 500);
    }
  }
};
