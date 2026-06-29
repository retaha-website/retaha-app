import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import { mergeAndTranslate, asLanguageCode } from '@retaha/i18n';

const VALID_TYPES = ['internal_action', 'external_link', 'info', 'phone', 'email'] as const;
type CardType = typeof VALID_TYPES[number];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function validateTarget(card_type: CardType, target: string | null): string | null {
  if (card_type === 'info') return null;
  if (card_type === 'internal_action') {
    if (!target) return 'action_target required for internal_action';
    return null;
  }
  if (card_type === 'external_link') {
    if (!target) return 'URL required';
    try { const u = new URL(target); if (!['http:', 'https:'].includes(u.protocol)) return 'http/https only'; }
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

  if (!body.card_type || !VALID_TYPES.includes(body.card_type)) {
    return json({ ok: false, error: 'Invalid card_type' }, 400);
  }
  const target = (body.action_target ?? '').toString().trim() || null;
  const targetErr = validateTarget(body.card_type, target);
  if (targetErr) return json({ ok: false, error: targetErr }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  const { data: hotelRow } = await sb
    .from('hotels').select('default_language, plan')
    .eq('id', hotel.id).maybeSingle();
  const defLang = asLanguageCode(hotelRow?.default_language);

  // Lite-Plan-Limit: nur bei INSERT (body.id === undefined) prüfen
  if (!body.id) {
    const currentPlan = (hotelRow?.plan as string | undefined) ?? 'lite';
    const LITE_LIMIT = 3;
    if (currentPlan === 'lite') {
      const { count } = await sb
        .from('hotel_action_cards')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotel.id);
      if ((count ?? 0) >= LITE_LIMIT) {
        return json({
          ok: false,
          error: `Limit erreicht: Im Lite-Plan sind maximal ${LITE_LIMIT} Action Cards erlaubt. Bitte eine Karte löschen oder auf Pro upgraden.`,
          limitReached: true,
        }, 403);
      }
    }
  }


  const title    = (body.title    ?? '').toString().trim();
  const subtitle = (body.subtitle ?? '').toString().trim();
  const eyebrow  = (body.eyebrow  ?? '').toString().trim();
  const cta      = (body.cta      ?? '').toString().trim();

  if (!title) return json({ ok: false, error: 'title required' }, 400);

  let existingI18n: Record<string, any> = {};
  if (body.id) {
    const { data: ex } = await sb
      .from('hotel_action_cards')
      .select('title_i18n, subtitle_i18n, eyebrow_i18n, cta_i18n')
      .eq('id', body.id).eq('hotel_id', hotel.id).maybeSingle();
    if (ex) existingI18n = ex;
  }

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
    title_de:    defLang === 'de' ? title             : undefined,
    subtitle_de: defLang === 'de' ? (subtitle || null) : undefined,
    eyebrow_de:  defLang === 'de' ? (eyebrow  || null) : undefined,
    cta_de:      defLang === 'de' ? (cta      || null) : undefined,
    card_class: (body.card_class ?? 'rec-anthrazit').toString(),
    is_published: body.is_published !== false,
  };
  for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];

  // Lite: nur 1 Karte darf aktiv sein — alle anderen deaktivieren wenn diese gespeichert wird
  const savingPlan = (hotelRow?.plan as string | undefined) ?? 'lite';
  if (savingPlan === 'lite' && fields.is_published === true) {
    let q = sb.from('hotel_action_cards').update({ is_published: false }).eq('hotel_id', hotel.id);
    if (body.id) q = q.neq('id', body.id);
    await q;
  }

  if (body.id) {
    const { data, error } = await sb
      .from('hotel_action_cards')
      .update(fields)
      .eq('id', body.id)
      .eq('hotel_id', hotel.id)
      .select('id')
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data)  return json({ ok: false, error: 'Not found or forbidden' }, 404);
    return json({ ok: true, id: data.id, isNew: false });
  }

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
  return json({ ok: true, id: data.id, isNew: true });
};
