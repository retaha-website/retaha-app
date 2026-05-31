// Sprint E2 · Phase 8 — On-Demand-Endpoint für Auto-Place-Details
//
// GET /api/places/details?placeId=...
//
// Frontend ruft das beim Click auf eine Auto-Suggestion auf — Picks haben
// vollständige cached_data, Auto-Places nur Minimal-Felder aus
// hotel_place_nearby_cache. Mit diesem Endpoint holt das Frontend die
// Atmosphere-Felder (hours, reviews, website, phone) on-demand.
//
// Cost: ~$0.02 pro Call (Atmosphere-SKU $20/1k, 1k frei). Backlog:
// in-memory oder DB-Cache für 1h damit Refresh-Reads gratis bleiben.
//
// Auth: Stay-Session-Cookie (Sprint D Phase 3) — verhindert dass Anon-
// Visitors die Google-API-Calls auf unsere Kosten triggern.

import type { APIRoute } from 'astro';
import { getStaySession } from '../../../lib/auth/stay-session';
import { getPlaceDetails, buildPhotoUrl } from '../../../lib/places/google-client';

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'Unauthorized — no stay session' }, 401);

  const placeId = url.searchParams.get('placeId')?.trim();
  if (!placeId) return json({ ok: false, error: 'Missing placeId' }, 400);

  // Sprach-Param aus URL (sonst Default DE)
  const langParam = url.searchParams.get('lang')?.toLowerCase();
  const languageCode = (langParam === 'en' || langParam === 'fr' || langParam === 'es') ? langParam : 'de';

  try {
    const details = await getPlaceDetails(placeId, { includeAtmosphere: true, languageCode });
    // Photo-URLs serverseitig bauen (API-Key bleibt im Backend — Frontend bekommt fertige URLs)
    const photoUrls = details.photoNames.slice(0, 8).map(n => buildPhotoUrl(n, 1200));
    return json({ ok: true, details: { ...details, photoUrls } }, 200);
  } catch (err) {
    console.error('[places/details] failed:', err);
    return json({ ok: false, error: (err as Error).message ?? 'Google Places error' }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
