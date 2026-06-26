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
  if (!hotel) return json({ ok: false, error: 'No hotel' }, 403);

  let body: { ids?: string[] };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return json({ ok: false, error: 'ids array required' }, 400);
  }

  const sb = createSupabaseServerInstance(cookies, request);
  for (let i = 0; i < body.ids.length; i++) {
    const { error } = await sb
      .from('hotel_action_cards')
      .update({ sort_order: i })
      .eq('id', body.ids[i])
      .eq('hotel_id', hotel.id);
    if (error) return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
