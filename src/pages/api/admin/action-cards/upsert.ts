// Sprint E7 Phase 3 — Action-Card upsert (create + update)
//
// POST JSON body:
//   id?: UUID (wenn vorhanden → UPDATE, sonst INSERT)
//   card_type: 'internal_action' | 'external_link' | 'info' | 'phone' | 'email'
//   action_target?: string
//   title_de: string (NOT NULL)
//   title_en|fr|es?, subtitle_*?, eyebrow_*?, cta_*?
//   card_class?: string
//   is_published?: boolean
//
// Returns: { ok, id, isNew, error? }

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '../../../../lib/auth';
import { mergeAndTranslate, asLanguageCode } from '../../../../lib/i18n/save-hook.ts';

const VALID_TYPES = ['internal_action', 'external_link', 'info', 'phone', 'email'] as const;
type CardType = typeof VALID_TYPES[number];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function validateTarget(card_type: CardType, target: string | null): string | null {
  if (card_type === 'info') return null; // info erlaubt explizit kein target
  if (card_type === 'internal_action') {
    if (!target) return 'action_target required for internal_action';
    return null;
  }
  if (card_type === 'external_link') {
    if (!target) return 'URL required';
    try { const u = new URL(target); if (!['http:','https:'].includes(u.protocol)) return 'http/https only'; }
    catch { return 'Invalid URL'; }
    return null;
  }
  if (card_type === 'phone') {
    if (!target || !/^[+\d\s()\-./]{4,}$/.test(target)) return 'Invalid phone number';
    return null;
  }
  if (card_type === 'email') {
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return 'Invalid email';
    return null;
  }
  return null;
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  // Required fields
  if (!body.card_type || !VALID_TYPES.includes(body.card_type)) {
    return json({ ok: false, error: 'Invalid card_type' }, 400);
  }
  const target = (body.action_target ?? '').toString().trim() || null;
  const targetErr = validateTarget(body.card_type, target);
  if (targetErr) return json({ ok: false, error: targetErr }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  // Sprint i18n Phase 5 — 1-Feld-UX: Hotelier sendet je Feld nur 1 Wert
  // in seiner Default-Sprache. Wir schreiben in {field}_i18n[default] +
  // mirror auf alte _de-Spalte (Safety bis Phase 10).
  const { data: hotelLang } = await sb
    .from('hotels').select('default_language')
    .eq('id', hotel.id).maybeSingle();
  const defLang = asLanguageCode(hotelLang?.default_language);

  const title    = (body.title    ?? body.title_de    ?? '').toString().trim();
  const subtitle = (body.subtitle ?? body.subtitle_de ?? '').toString().trim();
  const eyebrow  = (body.eyebrow  ?? body.eyebrow_de  ?? '').toString().trim();
  const cta      = (body.cta      ?? body.cta_de      ?? '').toString().trim();

  if (!title) return json({ ok: false, error: 'title required' }, 400);

  // Existing i18n laden (override-Werte erhalten + 'auto'-Re-Translate vermeiden falls Original unverändert)
  let existingI18n: Record<string, any> = {};
  if (body.id) {
    const { data: ex } = await sb
      .from('hotel_action_cards')
      .select('title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n')
      .eq('id', body.id).eq('hotel_id', hotel.id).maybeSingle();
    if (ex) existingI18n = ex;
  }

  // Sprint i18n Phase 6 — mergeAndTranslate: Original + Auto-Translation parallel
  // (synchron im Save weil Astro/Vercel keine post-response Promises supported)
  const labelBase = `action_cards.${body.id ?? 'new'}`;
  const [titleR, subtitleR, eyebrowR, ctaR] = await Promise.all([
    mergeAndTranslate(existingI18n.title_i18n,    title,    defLang, { logLabel: `${labelBase}.title`    }),
    mergeAndTranslate(existingI18n.subtitle_i18n, subtitle, defLang, { logLabel: `${labelBase}.subtitle` }),
    mergeAndTranslate(existingI18n.eyebrow_i18n,  eyebrow,  defLang, { logLabel: `${labelBase}.eyebrow`  }),
    mergeAndTranslate(existingI18n.cta_i18n,      cta,      defLang, { logLabel: `${labelBase}.cta`      }),
  ]);

  const fields: Record<string, any> = {
    hotel_id: hotel.id,
    card_type: body.card_type,
    action_target: target,
    title_i18n:    Object.keys(titleR.i18n).length    > 0 ? titleR.i18n    : null,
    subtitle_i18n: Object.keys(subtitleR.i18n).length > 0 ? subtitleR.i18n : null,
    eyebrow_i18n:  Object.keys(eyebrowR.i18n).length  > 0 ? eyebrowR.i18n  : null,
    cta_i18n:      Object.keys(ctaR.i18n).length      > 0 ? ctaR.i18n      : null,
    // Safety-Net: alte DE-Spalten synchron halten falls default=DE (Phase 10 dropt)
    title_de:    defLang === 'de' ? title    : undefined,
    subtitle_de: defLang === 'de' ? (subtitle || null) : undefined,
    eyebrow_de:  defLang === 'de' ? (eyebrow  || null) : undefined,
    cta_de:      defLang === 'de' ? (cta      || null) : undefined,
    card_class: (body.card_class ?? 'rec-anthrazit').toString(),
    is_published: body.is_published !== false,
  };
  // undefined-Felder rausstrippen (Postgres würde sonst NULL setzen)
  for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];

  // Translation-Cost-Summe an Caller (für UI-Feedback in Phase 6+)
  const totalUSD = titleR.cost.estimatedUSD + subtitleR.cost.estimatedUSD + eyebrowR.cost.estimatedUSD + ctaR.cost.estimatedUSD;
  const totalFails = [...titleR.failures, ...subtitleR.failures, ...eyebrowR.failures, ...ctaR.failures];

  if (body.id) {
    // UPDATE
    const { data, error } = await sb
      .from('hotel_action_cards')
      .update(fields)
      .eq('id', body.id)
      .eq('hotel_id', hotel.id)
      .select('id')
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, error: 'Not found or forbidden' }, 404);
    return json({ ok: true, id: data.id, isNew: false, translation: { cost_usd: totalUSD, failures: totalFails.length } });
  }

  // INSERT — sort_order = max + 1
  const { data: maxRow } = await sb
    .from('hotel_action_cards')
    .select('sort_order')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  fields.sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await sb
    .from('hotel_action_cards')
    .insert(fields)
    .select('id')
    .single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, isNew: true, translation: { cost_usd: totalUSD, failures: totalFails.length } });
};
