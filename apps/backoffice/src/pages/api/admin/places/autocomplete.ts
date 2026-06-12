import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import { placesAutocomplete } from '../../../../lib/places/google-client';

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ ok: true, suggestions: [] }, 200);

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
      radius: 5000,
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
