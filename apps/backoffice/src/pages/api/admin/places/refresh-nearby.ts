import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import { buildNearbyCache } from '../../../../lib/places/nearby-actions';
import type { PickCategory } from '../../../../lib/places/google-client';

const ALL_CATEGORIES: PickCategory[] = ['restaurant', 'cafe', 'bar', 'activity', 'sight'];

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: { category?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sb = createSupabaseServerInstance(cookies, request);
  const { data: hotelRow } = await sb
    .from('hotels')
    .select('latitude, longitude')
    .eq('id', hotel.id)
    .maybeSingle();

  const lat = hotelRow?.latitude as number | null | undefined;
  const lng = hotelRow?.longitude as number | null | undefined;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return json({ ok: false, error: 'Hotel hat keine Adresse — bitte zuerst in /admin/settings ergänzen.' }, 400);
  }

  let cats: PickCategory[];
  if (!body.category || body.category === 'all') {
    cats = ALL_CATEGORIES;
  } else if (ALL_CATEGORIES.includes(body.category as PickCategory)) {
    cats = [body.category as PickCategory];
  } else {
    return json({ ok: false, error: `Ungültige Kategorie: ${body.category}` }, 400);
  }

  const result = await buildNearbyCache(hotel.id, lat, lng, cats);
  return json({ ok: true, ...result }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
