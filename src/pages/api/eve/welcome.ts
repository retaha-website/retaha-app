// Sprint E4 · Phase 10 — Smart-Welcome Endpoint
//
// POST /api/eve/welcome — idempotent. Beim ersten Sheet-Open vom Frontend
// gerufen. Prüft ob bereits Messages für den Stay existieren — wenn ja:
// return null (kein neuer Welcome, History nutzen). Wenn nein: generiert
// personalisierte Welcome-Message via Haiku, persistiert sie in
// chat_messages, returnt die Message.

import type { APIRoute } from 'astro';
import { getStaySession } from '../../../lib/auth/stay-session';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { eveComplete, EVE_MODEL_HAIKU } from '../../../lib/eve/anthropic-client';
import { buildSystemPrompt, type EveContext } from '../../../lib/eve/system-prompt';
import { getTranslatedKnowledge } from '../../../lib/eve/translator';
import type { Lang } from '../../../lib/i18n';
import { normalizeLang } from '../../../lib/i18n';

const WELCOME_PROMPT_BY_LANG: Record<Lang, string> = {
  de: 'Bitte begrüße den Gast jetzt mit einer kurzen, persönlichen Welcome-Message. Maximal 2 Sätze. Nutze seinen Vornamen wenn bekannt. Erwähne keine vollständige Liste was du kannst — nur einen einladenden Anstoß ("Frag mich gerne nach …").',
  en: 'Please greet the guest now with a short, personal welcome message. Maximum 2 sentences. Use their first name if known. Do not list everything you can do — just an inviting nudge ("Feel free to ask me about …").',
  fr: 'Veuillez accueillir l\'invité maintenant avec un message de bienvenue court et personnel. Maximum 2 phrases. Utilisez son prénom si connu. Ne listez pas tout ce que vous pouvez faire — juste une invitation chaleureuse ("N\'hésitez pas à me demander …").',
  es: 'Por favor saluda al huésped ahora con un mensaje de bienvenida corto y personal. Máximo 2 frases. Usa su nombre de pila si lo conoces. No enumeres todo lo que puedes hacer — solo una invitación amable ("No dudes en preguntarme por …").',
};

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getStaySession(cookies);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized — no stay session' }, 401);
  }

  const supabase = createSupabaseServiceRoleInstance();

  // 1. Idempotenz: schon Messages für diesen Stay?
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stay_id', session.stay_id);

  if ((count ?? 0) > 0) {
    return json({ ok: true, welcome: null, reason: 'history_exists' });
  }

  // 2. Eve-Enabled-Check
  const ctx = await loadEveWelcomeContext(supabase, session.hotel_id, session.stay_id);
  if (!ctx) return json({ ok: false, error: 'Context-Load fehlgeschlagen' }, 500);
  if (!ctx.hotelSettings.eve_enabled) {
    return json({ ok: false, error: 'Eve nicht aktiviert' }, 403);
  }

  // 3. Welcome via Haiku generieren
  try {
    const systemPrompt = buildSystemPrompt(ctx);
    const welcomePrompt = WELCOME_PROMPT_BY_LANG[ctx.language] ?? WELCOME_PROMPT_BY_LANG.de;

    const result = await eveComplete({
      model: EVE_MODEL_HAIKU,
      systemPrompt,
      messages: [{ role: 'user', content: welcomePrompt }],
      enableCaching: true,
      maxTokens: 256,
    });

    // 4. Persistieren — KEIN router_decision (system-getriggert, kein Router-Lauf)
    await supabase.from('chat_messages').insert({
      hotel_id: session.hotel_id,
      stay_id: session.stay_id,
      role: 'assistant',
      content: result.content,
      model_used: result.model,
      prompt_tokens: result.usage.inputTokens + result.usage.cacheCreationTokens,
      completion_tokens: result.usage.outputTokens,
      cached_input_tokens: result.usage.cachedInputTokens,
      router_decision: { reason: 'system_welcome', model: result.model },
    });

    return json({ ok: true, welcome: result.content });
  } catch (err) {
    console.error('[eve/welcome] failed:', err);
    return json({ ok: false, error: (err as Error).message ?? String(err) }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadEveWelcomeContext(sb: any, hotelId: string, stayId: string): Promise<EveContext | null> {
  const [hotelRes, settingsRes, knowledgeRes, stayRes] = await Promise.all([
    sb.from('hotels').select('id, name, city, country, default_language').eq('id', hotelId).maybeSingle(),
    sb.from('hotel_settings').select(`
      eve_enabled, eve_name, eve_tonality, eve_custom_persona, eve_tuning_rules,
      guest_address_form,
      wifi_ssid, wifi_password, wifi_speed_mbits,
      breakfast_start_time, breakfast_end_time,
      breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es,
      conference_rooms, conference_start_time, conference_end_time
    `).eq('hotel_id', hotelId).maybeSingle(),
    sb.from('eve_knowledge')
      .select('category, question, answer')
      .eq('hotel_id', hotelId).eq('language_code', 'de').eq('is_published', true),
    sb.from('stays')
      .select('id, check_in, check_out, raw_mews_data, guests(first_name, last_name, language), rooms(room_number, room_name)')
      .eq('id', stayId).maybeSingle(),
  ]);

  if (!hotelRes.data || !settingsRes.data) return null;
  const guest = stayRes.data?.guests as any;
  const lang: Lang = normalizeLang(guest?.language ?? hotelRes.data.default_language ?? 'de');

  const knowledge = lang === 'de'
    ? (knowledgeRes.data ?? []) as any
    : await getTranslatedKnowledge(hotelId, lang as 'en' | 'fr' | 'es');

  return {
    hotel: hotelRes.data,
    hotelSettings: settingsRes.data,
    stay: stayRes.data ? {
      id: stayRes.data.id,
      check_in: stayRes.data.check_in,
      check_out: stayRes.data.check_out,
      raw_mews_data: stayRes.data.raw_mews_data,
    } : null,
    guest,
    room: (stayRes.data?.rooms as any) ?? null,
    knowledge,
    language: lang,
  };
}
