import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import Anthropic from '@anthropic-ai/sdk';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const TRIGGERS = [
  { type: 'welcome',                label: 'Willkommens-Push (Check-in bestätigt)' },
  { type: 'room_ready',             label: 'Zimmer bereit' },
  { type: 'service_confirmed',      label: 'Service-Anfrage bestätigt' },
  { type: 'service_declined',       label: 'Service-Anfrage abgelehnt' },
  { type: 'late_checkout_approved', label: 'Late Checkout genehmigt' },
  { type: 'restaurant_reservation', label: 'Restaurantreservierung bestätigt' },
  { type: 'spa_reservation',        label: 'Spa-Buchung bestätigt' },
  { type: 'housekeeping_done',      label: 'Zimmer wurde gereinigt' },
  { type: 'checkout_reminder',      label: 'Check-out Erinnerung' },
];

const SUGGESTIONS_TOOL = {
  name: 'stay_push_suggestions',
  description: 'Push-Texte (Titel + Body) für alle Stay-Push-Trigger eines Hotels',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            trigger_type: { type: 'string' },
            title: { type: 'string', description: 'Push-Titel, max 60 Zeichen, prägnant' },
            body:  { type: 'string', description: 'Push-Text, max 120 Zeichen, persönlich und konkret' },
          },
          required: ['trigger_type', 'title', 'body'],
        },
      },
    },
    required: ['suggestions'],
  },
};

const HOTEL_TYPE_LABELS: Record<string, string> = {
  city:     'Stadthotel',
  resort:   'Resort',
  wellness: 'Wellnesshotel',
  business: 'Businesshotel',
  boutique: 'Boutiquehotel',
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { tone?: string };
  try { body = await request.json(); } catch { body = {}; }
  const tone = String(body.tone ?? '').trim().slice(0, 200);

  const sb = createSupabaseServiceRoleInstance();

  // Hoteldaten aus DB
  const { data: h } = await sb
    .from('hotels')
    .select('name, hotel_type, classification, city, country, website')
    .eq('id', hotel.id)
    .maybeSingle();

  // Eve-Wissensbasis (bis zu 12 Einträge als Kontext)
  const { data: knowledge } = await sb
    .from('eve_knowledge')
    .select('question, answer')
    .eq('hotel_id', hotel.id)
    .limit(12);

  const hotelName = (h as any)?.name ?? hotel.name ?? 'das Hotel';
  const hotelType = HOTEL_TYPE_LABELS[(h as any)?.hotel_type] ?? '';
  const stars     = (h as any)?.classification ? `${(h as any).classification} Sterne` : '';
  const location  = [(h as any)?.city, (h as any)?.country].filter(Boolean).join(', ');

  const hotelContext = [
    `Name: ${hotelName}`,
    hotelType  && `Typ: ${hotelType}`,
    stars      && `Kategorie: ${stars}`,
    location   && `Ort: ${location}`,
  ].filter(Boolean).join('\n');

  const knowledgeContext = (knowledge ?? []).length > 0
    ? '\n\nWissensbasis (FAQ / Fakten aus der Hotel-Website):\n' +
      (knowledge ?? []).map((k: any) => `– ${k.question}: ${k.answer}`).join('\n')
    : '';

  const toneContext = tone
    ? `\n\nTon-Vorgabe vom Hotelier: "${tone}"`
    : '';

  const triggerList = TRIGGERS.map(t => `- ${t.type}: ${t.label}`).join('\n');

  const prompt = `Du bist Spezialist für Gäste-Kommunikation und Wallet-Push-Nachrichten.

Hoteldaten:
${hotelContext}${knowledgeContext}${toneContext}

Schreibe für jeden der folgenden 9 Stay-Push-Trigger einen Titel (max 60 Zeichen) und einen Body-Text (max 120 Zeichen) auf Deutsch.
Die Texte erscheinen als Push-Nachrichten auf dem Smartphone des Gastes via Apple Wallet oder Google Wallet.${tone ? '' : '\nTonalität: Warm, persönlich, zum Charakter des Hotels passend.'}
Keine generischen Textbausteine — jeder Text soll sich nach diesem konkreten Haus anfühlen.
Platzhalter erlaubt: {{first_name}}, {{hotel_name}}, {{room_number}}, {{service_name}}, {{checkout_time}}, {{spa_service_name}}.

Trigger-Typen:
${triggerList}`;

  try {
    const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      tools: [SUGGESTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'stay_push_suggestions' },
      messages: [{ role: 'user', content: prompt }],
    });
    const toolBlock = msg.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') return json({ ok: false, error: 'no_output' }, 500);
    return json({ ok: true, ...(toolBlock.input as object) });
  } catch (e) {
    console.error('[stay-pushes/generate]', e);
    return json({ ok: false, error: 'generation_failed' }, 500);
  }
};
