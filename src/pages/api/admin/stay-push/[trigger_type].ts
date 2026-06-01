// Sprint Wallet · Modul D — Stay-Push-Template Update
//
// PUT /api/admin/stay-push/[trigger_type]
// Body: { title_default, body_default, is_active }
// Permission: content.write
//
// Pattern: ein Template pro (hotel_id, trigger_type) via UNIQUE-Constraint.
// UPSERT damit auch Hotels ohne initialen Eintrag (z.B. neu angelegt nach
// der Backfill-Migration) sauber durch das Speichern initialisiert werden.
//
// Auto-Translate via mergeAndTranslateMarketing — protected gegen Variable-
// Drift wie in Phase 11.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../lib/auth';
import { requirePermission } from '../../../../lib/auth/require-permission';
import { validateStayPushVariables } from '../../../../lib/marketing/stay-push-variables';
import { mergeAndTranslateMarketing, asLanguageCode } from '../../../../lib/marketing/translate-with-vars';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_TRIGGERS = new Set([
  'welcome', 'service_confirmed', 'service_declined', 'late_checkout_approved',
  'restaurant_reservation', 'spa_reservation', 'housekeeping_done', 'room_ready',
  'checkout_reminder',
]);

interface Body {
  title_default?: string;
  body_default?: string;
  is_active?: boolean;
}

export const PUT: APIRoute = async ({ cookies, request, params }) => {
  const triggerType = params.trigger_type;
  if (!triggerType || !VALID_TRIGGERS.has(triggerType)) {
    return json({ ok: false, error: 'invalid_trigger_type' }, 400);
  }

  let body: Body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const title = body.title_default?.toString().trim();
  const bodyText = body.body_default?.toString().trim();
  if (!title) return json({ ok: false, error: 'missing_title' }, 400);
  if (!bodyText) return json({ ok: false, error: 'missing_body' }, 400);

  const validation = validateStayPushVariables(`${title} ${bodyText}`);
  if (!validation.ok) {
    return json({
      ok: false, error: 'invalid_variables',
      unknown: validation.unknown,
      forbidden: validation.forbidden,
    }, 400);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const hotelDefault = asLanguageCode((hotel as any).default_language);

  // Existing-Template laden für i18n-Merge (override-Slots behalten)
  const { data: existing } = await sb
    .from('stay_push_templates')
    .select('id, title_i18n, body_i18n')
    .eq('hotel_id', hotel.id)
    .eq('trigger_type', triggerType)
    .maybeSingle();

  const [titleResult, bodyResult] = await Promise.all([
    mergeAndTranslateMarketing(existing?.title_i18n ?? null, title, hotelDefault, { logLabel: `stay_push.title:${triggerType}` }),
    mergeAndTranslateMarketing(existing?.body_i18n  ?? null, bodyText, hotelDefault, { logLabel: `stay_push.body:${triggerType}` }),
  ]);
  const totalUSD = titleResult.cost.estimatedUSD + bodyResult.cost.estimatedUSD;
  console.info(`[stay_push.put ${triggerType}] auto-translate cost: $${totalUSD.toFixed(5)}`);

  const payload: Record<string, any> = {
    hotel_id: hotel.id,
    trigger_type: triggerType,
    title_i18n: titleResult.i18n,
    body_i18n: bodyResult.i18n,
  };
  if (typeof body.is_active === 'boolean') payload.is_active = body.is_active;

  const { error } = await sb.from('stay_push_templates').upsert(payload, { onConflict: 'hotel_id,trigger_type' });
  if (error) {
    console.error('[stay_push.put] upsert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
