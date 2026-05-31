// Sprint E2 · Phase 5 — Monatlicher Refresh-Cron für hotel_place_picks
//
// Vercel-Cron-Schedule (vercel.json): "0 4 1 * *" — 1. des Monats, 04:00 UTC.
// Lädt alle Picks mit last_refresh < NOW() - 30 days und ruft
// Google getPlaceDetails (Atmosphere-SKU $20/1k, 1k frei/Monat) erneut.
//
// Rate-Limit-friendly: 100ms sleep zwischen Calls (auch wenn Google's QPM-Cap
// bei 600 liegt — wir kommen nie ran, sicher ist sicher).
//
// Auth: Bearer ${CRON_SECRET} analog Sprint E1 Phase 5+6 / Sprint E4 Phase 11.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';
import { getPlaceDetails } from '../../../lib/places/google-client';

const REFRESH_AGE_DAYS = 30;
const SLEEP_BETWEEN_CALLS_MS = 100;
const SKU_ATMOSPHERE_USD_PER_1K = 20.00;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/places-refresh] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  // PLACES_REFRESH_ENABLED Feature-Flag — Notfall-Kill-Switch
  if (getEnv('PLACES_REFRESH_ENABLED') !== 'true') {
    console.info('[cron/places-refresh] disabled via PLACES_REFRESH_ENABLED');
    return json({ ok: true, skipped: true, reason: 'PLACES_REFRESH_ENABLED != true' }, 200);
  }

  const startedAt = new Date().toISOString();
  const sb = createSupabaseServiceRoleInstance();

  // Stale Picks laden (älter als 30 Tage ODER nie refreshed)
  const cutoff = new Date(Date.now() - REFRESH_AGE_DAYS * 86_400_000).toISOString();
  const { data: stalePicks, error: loadErr } = await sb
    .from('hotel_place_picks')
    .select('id, place_id, last_refresh, hotel_id')
    .eq('is_published', true)
    .or(`last_refresh.is.null,last_refresh.lt.${cutoff}`)
    .order('last_refresh', { ascending: true, nullsFirst: true })
    .limit(500);  // Sicherheits-Cap pro Run

  if (loadErr) {
    console.error('[cron/places-refresh] load failed:', loadErr.message);
    return json({ ok: false, error: loadErr.message }, 500);
  }

  const picks = stalePicks ?? [];
  let refreshed = 0;
  let failed = 0;
  const errors: Array<{ pick_id: string; error: string }> = [];

  for (const pick of picks) {
    try {
      const details = await getPlaceDetails(pick.place_id, { includeAtmosphere: true, languageCode: 'de' });
      const cachedData = {
        name: details.name,
        formatted_address: details.formattedAddress,
        location: details.location,
        types: details.types,
        google_maps_uri: details.googleMapsUri,
        rating: details.rating,
        user_ratings_total: details.userRatingCount,
        price_level: details.priceLevel,
        website_uri: details.websiteUri,
        international_phone_number: details.internationalPhoneNumber,
        opening_hours: details.openingHours,
        reviews: details.reviews?.slice(0, 3),
      };
      await sb.from('hotel_place_picks').update({
        cached_data: cachedData,
        photo_references: details.photoNames,
        last_refresh: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', pick.id);
      refreshed++;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.error(`[cron/places-refresh] pick ${pick.id} failed: ${msg}`);
      errors.push({ pick_id: pick.id, error: msg });
      failed++;
    }
    await sleep(SLEEP_BETWEEN_CALLS_MS);  // Rate-Limit-friendly
  }

  // Free-Tier-Warning
  const freeWarning = getEnv('PLACES_FREE_TIER_CAP_WARNING');
  const warnThreshold = freeWarning ? parseInt(freeWarning, 10) : 0;

  const finishedAt = new Date().toISOString();
  const estimatedCostUsd = (refreshed / 1000) * SKU_ATMOSPHERE_USD_PER_1K;

  console.info(
    `[cron/places-refresh] run ${startedAt} → ${finishedAt}: ` +
    `refreshed=${refreshed}/${picks.length}, failed=${failed}, ` +
    `est-cost-usd=$${estimatedCostUsd.toFixed(4)} (Atmosphere-SKU, 1k frei/Monat)`
  );

  if (warnThreshold > 0 && refreshed > warnThreshold) {
    console.warn(
      `[cron/places-refresh] WARNING: ${refreshed} Calls > Threshold ${warnThreshold} — ` +
      `Free-Tier-Cap nähert sich. Anthropic: tasks.refresh-schedule-anpassen.`
    );
  }

  return json({
    ok: true,
    started_at: startedAt,
    finished_at: finishedAt,
    total_stale: picks.length,
    refreshed,
    failed,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(4)),
    errors: errors.slice(0, 10),  // nur erste 10 Fehler im Response (Rest in Logs)
  }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
