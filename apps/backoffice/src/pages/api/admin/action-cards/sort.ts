// Sprint E7 Phase 3 — Action-Card sort (↑↓ Buttons)
//
// POST JSON: { id, direction: 'up' | 'down' }
// Tauscht sort_order mit der Nachbar-Card (oder no-op an Rändern).

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

  let body: { id?: string; direction?: 'up' | 'down' };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  if (!body.id || !['up', 'down'].includes(body.direction!)) {
    return json({ ok: false, error: 'id + direction required' }, 400);
  }

  const sb = createSupabaseServerInstance(cookies, request);
  const { data: cards } = await sb
    .from('hotel_action_cards')
    .select('id, sort_order')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: true });

  if (!cards || cards.length === 0) return json({ ok: false, error: 'No cards' }, 404);

  const idx = cards.findIndex(c => c.id === body.id);
  if (idx < 0) return json({ ok: false, error: 'Card not found' }, 404);

  const swapIdx = body.direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= cards.length) {
    return json({ ok: true, noop: true }); // bereits am Rand
  }

  const a = cards[idx], b = cards[swapIdx];
  // Zwei separate UPDATEs (RLS-safe). PostgreSQL hat keinen Unique-Constraint
  // auf sort_order, also kein temporärer Slot nötig.
  const upd1 = await sb.from('hotel_action_cards').update({ sort_order: b.sort_order }).eq('id', a.id).eq('hotel_id', hotel.id);
  if (upd1.error) return json({ ok: false, error: upd1.error.message }, 500);
  const upd2 = await sb.from('hotel_action_cards').update({ sort_order: a.sort_order }).eq('id', b.id).eq('hotel_id', hotel.id);
  if (upd2.error) return json({ ok: false, error: upd2.error.message }, 500);

  return json({ ok: true });
};
