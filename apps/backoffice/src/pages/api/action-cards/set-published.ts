import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  if (!body.id) return json({ ok: false, error: 'id required' }, 400);

  const sb = createSupabaseServerInstance(cookies, request);
  const { data, error } = await sb
    .from('hotel_action_cards')
    .update({ is_published: body.is_published !== false })
    .eq('id', body.id)
    .eq('hotel_id', hotel.id)
    .select('id, is_published')
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: 'Not found or forbidden' }, 404);
  return json({ ok: true, id: data.id, is_published: data.is_published });
};
