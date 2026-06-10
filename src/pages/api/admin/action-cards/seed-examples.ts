// POST /api/admin/action-cards/seed-examples
// Calls insert_example_cards() for the user's hotel.
// Returns { ok: true, inserted: number } — 3 on first call, 0 if defaults already exist.
// Used by the "Beispiele laden" button in the card editor.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '../../../../lib/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  const sb = createSupabaseServerInstance(cookies, request);

  const { data, error } = await sb.rpc('insert_example_cards', { p_hotel_id: hotel.id });

  if (error) {
    console.error('[seed-examples] rpc error', error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, inserted: data ?? 0 });
};
