// Trial-Ablauf-Cron — täglich.
//
// Findet Hotels, deren 14-Tage-Pro-Trial abgelaufen ist (subscription_status='trial'
// UND trial_ends_at < now()) und die NICHT upgegradet haben (Upgrade ⇒ status
// 'active', wird hier nicht erfasst). Downgrade gemäß Plan-Spec:
//   - plan → 'lite' (generische Ein-QR-Mappe)
//   - subscription_status → 'expired'
//   - trial_ends_at → null (Testphasen-Banner verschwindet)
//   - hotel_settings.eve_enabled → false (Eve gehört nicht zu lite)
//
// Auth: Bearer ${CRON_SECRET} (wie die übrigen Crons). Vercel-Schedule in vercel.json.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/trial-expiry] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) return json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = createSupabaseServiceRoleInstance();
  const nowIso = new Date().toISOString();

  // Abgelaufene Trials ohne Upgrade.
  const { data: expired, error: selErr } = await sb
    .from('hotels')
    .select('id')
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', nowIso);
  if (selErr) {
    console.error('[cron/trial-expiry] select', selErr.message);
    return json({ ok: false, error: selErr.message }, 500);
  }

  const ids = (expired ?? []).map((h: any) => h.id);
  if (ids.length === 0) return json({ ok: true, downgraded: 0 });

  const { error: hErr } = await sb
    .from('hotels')
    .update({ plan: 'lite', subscription_status: 'expired', trial_ends_at: null })
    .in('id', ids);
  if (hErr) {
    console.error('[cron/trial-expiry] hotels update', hErr.message);
    return json({ ok: false, error: hErr.message }, 500);
  }

  // Eve aus (lite hat kein Eve). Best effort — Hotel-Downgrade ist bereits passiert.
  const { error: sErr } = await sb
    .from('hotel_settings')
    .update({ eve_enabled: false })
    .in('hotel_id', ids);
  if (sErr) console.error('[cron/trial-expiry] eve disable', sErr.message);

  console.info(`[cron/trial-expiry] downgraded ${ids.length} hotel(s) to lite`);
  return json({ ok: true, downgraded: ids.length });
};
