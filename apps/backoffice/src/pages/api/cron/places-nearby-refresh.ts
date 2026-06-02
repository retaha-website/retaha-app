// Sprint E2 · Phase 6 — Monatlicher Cron: alle Hotels Nearby-Cache refresh
//
// Vercel-Cron-Schedule (vercel.json): "0 5 1 * *" — 1. des Monats, 05:00 UTC
// (1h nach places-refresh damit's nicht kollidiert).
//
// Pro Hotel: buildNearbyCache (5 Categories × ~20 Places = ~100 Places).
// 500ms Stagger zwischen Hotels (pro Hotel sind das 5 Google-Calls, also
// langsamer als Pick-Refresh).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { buildNearbyCache } from '../../../lib/places/nearby-actions';

const SLEEP_BETWEEN_HOTELS_MS = 500;
const SKU_NEARBY_ESS_USD_PER_1K = 5.00;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/places-nearby-refresh] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (getEnv('PLACES_REFRESH_ENABLED') !== 'true') {
    console.info('[cron/places-nearby-refresh] disabled via PLACES_REFRESH_ENABLED');
    return json({ ok: true, skipped: true, reason: 'PLACES_REFRESH_ENABLED != true' }, 200);
  }

  const startedAt = new Date().toISOString();
  const sb = createSupabaseServiceRoleInstance();

  const { data: hotels, error: loadErr } = await sb
    .from('hotels')
    .select('id, name, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .eq('is_active', true);

  if (loadErr) {
    console.error('[cron/places-nearby-refresh] hotels query failed:', loadErr.message);
    return json({ ok: false, error: loadErr.message }, 500);
  }

  const perHotel: Array<{
    hotel_id: string;
    hotel_name: string | null;
    refreshed_categories: string[];
    failed_categories: Array<{ category: string; error: string }>;
    total_places_cached: number;
  }> = [];
  const totals = { hotels_ok: 0, hotels_failed: 0, total_google_calls: 0, total_places_cached: 0 };

  for (let i = 0; i < (hotels?.length ?? 0); i++) {
    const h = hotels![i];
    try {
      const r = await buildNearbyCache(h.id, h.latitude as number, h.longitude as number);
      perHotel.push({
        hotel_id: h.id,
        hotel_name: h.name ?? null,
        refreshed_categories: r.refreshed_categories,
        failed_categories: r.failed_categories,
        total_places_cached: r.total_places_cached,
      });
      totals.total_google_calls += r.refreshed_categories.length + r.failed_categories.length;
      totals.total_places_cached += r.total_places_cached;
      if (r.failed_categories.length === 0) totals.hotels_ok++;
      else totals.hotels_failed++;
    } catch (err) {
      console.error(`[cron/places-nearby-refresh] hotel ${h.id} unexpected:`, (err as Error).message);
      totals.hotels_failed++;
    }
    if (i < hotels!.length - 1) await sleep(SLEEP_BETWEEN_HOTELS_MS);
  }

  const finishedAt = new Date().toISOString();
  const estimatedCostUsd = (totals.total_google_calls / 1000) * SKU_NEARBY_ESS_USD_PER_1K;

  console.info(
    `[cron/places-nearby-refresh] run ${startedAt} → ${finishedAt}: ` +
    `${totals.hotels_ok}/${hotels?.length ?? 0} hotels ok, ${totals.hotels_failed} failed, ` +
    `${totals.total_google_calls} Google-Calls, ${totals.total_places_cached} places cached, ` +
    `est-cost-usd=$${estimatedCostUsd.toFixed(4)} (Essentials-SKU, 10k frei/Monat)`
  );

  return json({
    ok: true,
    started_at: startedAt,
    finished_at: finishedAt,
    hotels: hotels?.length ?? 0,
    totals,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(4)),
    per_hotel: perHotel,
  }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
