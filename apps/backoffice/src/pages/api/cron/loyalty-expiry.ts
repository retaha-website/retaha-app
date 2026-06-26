// Loyalty Punkte-Verfall — täglicher Cron (vercel.json: "0 5 * * *").
//
// Für jedes Hotel mit expiry_enabled=true:
//   Findet Gäste, deren letzte Aktivität ('earn' oder 'redeem') in loyalty_transactions
//   älter als expiry_months Monate ist UND die ein points_balance > 0 haben.
//   → Bucht ein 'adjust'-Eintrag (negativ) + setzt points_balance = 0.
//   → points_lifetime (Stufe) bleibt immer unberührt.
//
// Auth: Bearer ${CRON_SECRET} + LOYALTY_EXPIRY_ENABLED='true' Kill-Switch.
// Idempotent: guests mit balance=0 werden übersprungen.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/loyalty-expiry] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (getEnv('LOYALTY_EXPIRY_ENABLED') !== 'true') {
    console.info('[cron/loyalty-expiry] disabled via LOYALTY_EXPIRY_ENABLED');
    return json({ ok: true, skipped: true, reason: 'LOYALTY_EXPIRY_ENABLED != true' });
  }

  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // Hotels mit aktivem Verfall laden
  const { data: configs, error: cfgErr } = await sb
    .from('loyalty_config')
    .select('hotel_id, expiry_months')
    .eq('expiry_enabled', true);

  if (cfgErr) {
    console.error('[cron/loyalty-expiry] config fetch failed:', cfgErr);
    return json({ ok: false, error: cfgErr.message }, 500);
  }

  if (!configs || configs.length === 0) {
    return json({ ok: true, hotels_processed: 0, guests_expired: 0, duration_ms: Date.now() - startedAt });
  }

  let totalExpired = 0;
  const errors: string[] = [];

  for (const cfg of configs) {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - cfg.expiry_months);
      const cutoffIso = cutoff.toISOString();

      // Gäste, die balance > 0 haben und kein earn-Entry nach cutoff
      const { data: candidates, error: candErr } = await sb
        .from('loyalty_points')
        .select('id, guest_id, points_balance')
        .eq('hotel_id', cfg.hotel_id)
        .gt('points_balance', 0);

      if (candErr) {
        errors.push(`hotel ${cfg.hotel_id}: ${candErr.message}`);
        continue;
      }
      if (!candidates || candidates.length === 0) continue;

      // Letzte Aktivität (earn ODER redeem) für diese Gäste (batch).
      // 'adjust' zählt nicht — das ist der Verfall-Eintrag selbst.
      const guestIds = candidates.map((c: any) => c.guest_id);
      const { data: recentActivity, error: actErr } = await sb
        .from('loyalty_transactions')
        .select('guest_id')
        .eq('hotel_id', cfg.hotel_id)
        .in('type', ['earn', 'redeem'])
        .gt('created_at', cutoffIso)
        .in('guest_id', guestIds);

      if (actErr) {
        errors.push(`hotel ${cfg.hotel_id} activity: ${actErr.message}`);
        continue;
      }

      const activeGuests = new Set((recentActivity ?? []).map((r: any) => r.guest_id));
      const toExpire = (candidates as any[]).filter(c => !activeGuests.has(c.guest_id));
      if (toExpire.length === 0) continue;

      for (const lp of toExpire) {
        // Adjust-Transaktion (negativ → bringt Summe auf 0)
        const { error: txErr } = await sb.from('loyalty_transactions').insert({
          hotel_id: cfg.hotel_id,
          guest_id: lp.guest_id,
          type: 'adjust',
          points: -lp.points_balance,
          note: `Verfall nach ${cfg.expiry_months} Monaten Inaktivität`,
        });
        if (txErr) {
          errors.push(`hotel ${cfg.hotel_id} guest ${lp.guest_id} tx: ${txErr.message}`);
          continue;
        }

        // Balance auf 0 setzen (Lifetime unberührt)
        const { error: upErr } = await sb
          .from('loyalty_points')
          .update({ points_balance: 0, updated_at: new Date().toISOString() })
          .eq('id', lp.id);
        if (upErr) {
          errors.push(`hotel ${cfg.hotel_id} guest ${lp.guest_id} update: ${upErr.message}`);
          continue;
        }

        totalExpired++;
      }
    } catch (e: any) {
      errors.push(`hotel ${cfg.hotel_id} unexpected: ${e?.message}`);
    }
  }

  const duration_ms = Date.now() - startedAt;
  console.info(`[cron/loyalty-expiry] done — ${totalExpired} expired, ${errors.length} errors, ${duration_ms}ms`);

  return json({
    ok: errors.length === 0,
    hotels_processed: configs.length,
    guests_expired: totalExpired,
    errors: errors.length > 0 ? errors : undefined,
    duration_ms,
  });
};
