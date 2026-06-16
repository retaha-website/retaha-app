// POST /api/marketing/campaigns/generate-with-eve
// "✦ Mit Eve schreiben" — generiert Titel + Body + CTA für eine Kampagne
// via Anthropic Haiku im Stil des Hotels.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels } from '@retaha/auth';
import Anthropic from '@anthropic-ai/sdk';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies, request);
  if (!user) return resp({ ok: false, error: 'Unauthorized' }, 401);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return resp({ ok: false, error: 'no_hotel' }, 400);

  let body: { prompt?: string };
  try { body = await request.json(); } catch { return resp({ ok: false, error: 'invalid_json' }, 400); }
  const prompt = body.prompt?.toString().trim();
  if (!prompt || prompt.length < 3) return resp({ ok: false, error: 'prompt_too_short' }, 400);
  if (prompt.length > 500) return resp({ ok: false, error: 'prompt_too_long' }, 400);

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return resp({ ok: false, error: 'ai_not_configured' }, 500);

  const hotelName = (hotel as any).name ?? 'Hotel';
  const hotelLang = (hotel as any).default_language ?? 'de';
  const langLabel = hotelLang === 'en' ? 'English' : hotelLang === 'fr' ? 'Français' : 'Deutsch';

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Du bist ein Hotel-Marketing-Assistent für ${hotelName}.
Schreibe kurze, authentische Hotel-Marketing-Texte in ${langLabel}.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt (kein Markdown, kein Codeblock):
{"title":"...","body_html":"<p>...</p>","cta_label":"...oder null"}
Regeln:
- title: Betreff/Titel, max 80 Zeichen, klar und einladend
- body_html: 1-2 kurze Absätze als HTML-Absätze (<p>...</p>), max 100 Wörter gesamt
- cta_label: 2-5 Wörter für den Button, oder null wenn kein CTA passt
- Ton: professionell, warm, persönlich — kein Marketing-Slang
- Verfügbare Personalisierungs-Variablen: {{first_name}}, {{hotel_name}}, {{visit_count}}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return resp({ ok: false, error: 'ai_parse_error' }, 500);
      try { parsed = JSON.parse(match[0]); } catch { return resp({ ok: false, error: 'ai_parse_error' }, 500); }
    }

    if (!parsed?.title || !parsed?.body_html) return resp({ ok: false, error: 'ai_incomplete' }, 500);

    return resp({
      ok: true,
      title: String(parsed.title).slice(0, 120),
      body_html: String(parsed.body_html).slice(0, 5000),
      cta_label: parsed.cta_label && parsed.cta_label !== 'null'
        ? String(parsed.cta_label).slice(0, 60)
        : null,
    });
  } catch (err: any) {
    console.error('[eve-generate]', err?.message);
    return resp({ ok: false, error: 'ai_error' }, 500);
  }
};

function resp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
