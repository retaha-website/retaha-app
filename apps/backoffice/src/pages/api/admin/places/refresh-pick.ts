import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import { getPlaceDetails } from '../../../../lib/places/google-client';

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const id = body.id?.trim();
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  const { data: pick, error: loadErr } = await sb
    .from('hotel_place_picks')
    .select('id, place_id, hotel_id')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) return json({ ok: false, error: loadErr.message }, 500);
  if (!pick) return json({ ok: false, error: 'Pick nicht gefunden oder keine Berechtigung.' }, 404);
  if (pick.hotel_id !== hotel.id) return json({ ok: false, error: 'Forbidden' }, 403);

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
    const { error: updateErr } = await sb
      .from('hotel_place_picks')
      .update({
        cached_data: cachedData,
        photo_references: details.photoNames,
        last_refresh: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) return json({ ok: false, error: updateErr.message }, 500);
    return json({ ok: true, refreshed_at: new Date().toISOString(), name: details.name }, 200);
  } catch (err) {
    return json({ ok: false, error: `Google Places error: ${(err as Error).message}` }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
