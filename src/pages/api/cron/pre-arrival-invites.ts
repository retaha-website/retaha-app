// Sprint E1 Phase 5 — Cron Pre-Arrival-Trigger
//
// Vercel-Cron-Schedule (vercel.json): "0 8 * * *" — täglich 08:00 UTC.
// Iteriert über alle Hotels, ruft sendPreArrivalInvitesForHotel pro Hotel.
// Idempotent (stays.pre_arrival_sent_at). Mehrfach-Runs am gleichen Tag
// schicken keine Doppel-Mails.
//
// Auth: Vercel-Cron sendet "Authorization: Bearer ${CRON_SECRET}" wenn die
// ENV gesetzt ist. Wenn CRON_SECRET nicht gesetzt → 503 (Fehlkonfiguration,
// bewusst nicht 401 damit Vercel-Monitoring den Misskonfig sieht).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';
import { sendPreArrivalInvitesForHotel } from '../../../lib/email/send-pre-arrival-invites';

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/pre-arrival] CRON_SECRET nicht konfiguriert — Endpoint inaktiv');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }

  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const startedAt = new Date().toISOString();
  const sb = createSupabaseServiceRoleInstance();

  const { data: hotels, error } = await sb
    .from('hotels')
    .select('id, name')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[cron/pre-arrival] hotels query failed:', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  const perHotel: Array<{
    hotel_id: string;
    hotel_name: string | null;
    found: number;
    sent: number;
    skipped: number;
    failed: number;
  }> = [];
  const totals = { found: 0, sent: 0, skipped: 0, failed: 0 };

  for (const h of hotels ?? []) {
    try {
      const stats = await sendPreArrivalInvitesForHotel(h.id);
      perHotel.push({
        hotel_id: h.id,
        hotel_name: h.name ?? null,
        ...stats,
      });
      totals.found += stats.found;
      totals.sent += stats.sent;
      totals.skipped += stats.skipped;
      totals.failed += stats.failed;
    } catch (err) {
      // sendPreArrivalInvitesForHotel ist intern best-effort — wirft eigentlich
      // nie. Wenn doch, hier abfangen damit der Cron-Run für andere Hotels
      // weiterläuft.
      console.error(`[cron/pre-arrival] hotel ${h.id} unexpected:`, (err as Error).message);
      perHotel.push({
        hotel_id: h.id,
        hotel_name: h.name ?? null,
        found: 0, sent: 0, skipped: 0, failed: 0,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  console.info(
    `[cron/pre-arrival] run ${startedAt} → ${finishedAt}: ${hotels?.length ?? 0} hotels, ` +
    `found=${totals.found} sent=${totals.sent} skipped=${totals.skipped} failed=${totals.failed}`,
  );

  return json({
    ok: true,
    started_at: startedAt,
    finished_at: finishedAt,
    hotels: hotels?.length ?? 0,
    totals,
    per_hotel: perHotel,
  }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
