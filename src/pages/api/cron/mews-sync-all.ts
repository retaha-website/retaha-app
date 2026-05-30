// Sprint E1 Phase 6 — Cron Auto-Sync
//
// Vercel-Cron-Schedule (vercel.json): "0 */2 * * *" — alle 2h zur vollen Stunde.
// Iteriert über alle Hotels mit aktiver Mews-Integration und ruft
// syncHotelFromMews pro Hotel. Einzelne Sync-Fehler blockieren nicht den
// Run für andere Hotels — sync_status='error' wird via syncHotelFromMews
// selbst auf der mews_integrations-Row gesetzt.
//
// Pre-Arrival-Mail-Trigger läuft als Side-Effect IN syncHotelFromMews
// (Sprint D Phase 6a) — idempotent über stays.pre_arrival_sent_at.
//
// Auth: identisch zu /api/cron/pre-arrival-invites (Bearer ${CRON_SECRET}).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';
import { syncHotelFromMews, type SyncResult } from '../../../lib/mews/sync';

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/mews-sync] CRON_SECRET nicht konfiguriert — Endpoint inaktiv');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }

  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const startedAt = new Date().toISOString();
  const sb = createSupabaseServiceRoleInstance();

  // Hotels mit aktiver Integration: access_token_encrypted IS NOT NULL.
  // hotel_id+name aus dem Hotels-Join für lesbare Log-Output.
  const { data: integrations, error } = await sb
    .from('mews_integrations')
    .select('hotel_id, hotels(id, name)')
    .not('access_token_encrypted', 'is', null)
    .order('hotel_id', { ascending: true });

  if (error) {
    console.error('[cron/mews-sync] integrations query failed:', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  const perHotel: Array<{
    hotel_id: string;
    hotel_name: string | null;
    ok: boolean;
    error?: string;
    stats?: SyncResult;
  }> = [];
  const totals = { ok_count: 0, fail_count: 0, rooms: 0, reservations: 0, guests: 0 };

  for (const row of integrations ?? []) {
    const hotelId = row.hotel_id;
    const hotelName = (row.hotels as any)?.name ?? null;
    try {
      const stats = await syncHotelFromMews(hotelId);
      perHotel.push({ hotel_id: hotelId, hotel_name: hotelName, ok: true, stats });
      totals.ok_count++;
      totals.rooms += stats.rooms;
      totals.reservations += stats.reservations;
      totals.guests += stats.guests;
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      console.error(`[cron/mews-sync] hotel ${hotelId} failed:`, message);
      perHotel.push({ hotel_id: hotelId, hotel_name: hotelName, ok: false, error: message });
      totals.fail_count++;
      // sync_status='error' + sync_error_message wurde bereits von syncHotelFromMews
      // selbst geschrieben (siehe lib/mews/sync.ts catch-Block) — kein extra Update nötig.
    }
  }

  const finishedAt = new Date().toISOString();
  console.info(
    `[cron/mews-sync] run ${startedAt} → ${finishedAt}: ${integrations?.length ?? 0} hotels, ` +
    `ok=${totals.ok_count} fail=${totals.fail_count} (rooms=${totals.rooms} res=${totals.reservations} guests=${totals.guests})`,
  );

  return json({
    ok: true,
    started_at: startedAt,
    finished_at: finishedAt,
    hotels: integrations?.length ?? 0,
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
