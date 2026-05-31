// Sprint E2 · Phase 4 — Autocomplete-Proxy für Hotelier-UI
//
// GET /api/admin/places/autocomplete?q=...&category=...
//
// Frontend-Alpine ruft das beim Tippen (debounced 300ms). Wir proxy-en zu
// Google Places mit Hotel-Location-Bias + Category-Hint. Hotelier-Auth
// stellt sicher dass keine Anon-Visitors die API blocken.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels } from '../../../../lib/auth';
import { createSupabaseServerInstance } from '../../../../lib/auth';
import { placesAutocomplete } from '../../../../lib/places/google-client';

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ ok: true, suggestions: [] }, 200);

  // Hotel-Location-Bias laden — RLS-protected via createSupabaseServerInstance
  const sb = createSupabaseServerInstance(cookies, request);
  const { data: hotelRow } = await sb
    .from('hotels')
    .select('latitude, longitude')
    .eq('id', hotel.id)
    .maybeSingle();

  const lat = typeof hotelRow?.latitude === 'number' ? hotelRow.latitude : undefined;
  const lng = typeof hotelRow?.longitude === 'number' ? hotelRow.longitude : undefined;

  try {
    const suggestions = await placesAutocomplete(q, {
      lat, lng,
      radius: 5000,  // 5 km Bias — eng genug für nahe Vorschläge, weit genug für Berlin-weit
      languageCode: 'de',
    });
    return json({ ok: true, suggestions }, 200);
  } catch (err) {
    console.error('[places/autocomplete] failed:', err);
    return json({ ok: false, error: (err as Error).message ?? 'Google Places error' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
