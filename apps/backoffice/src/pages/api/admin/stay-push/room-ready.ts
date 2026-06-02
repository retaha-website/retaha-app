// Sprint Wallet · Modul D — Manueller Room-Ready Trigger
//
// POST /api/admin/stay-push/room-ready
// Body: { stay_id }
// Permission: operations.write
//
// Hotelier klickt im Admin-Dashboard "Zimmer bereit" für einen Stay.
// Best-Effort: Push-Fehler returnen wir in der Response damit Hotelier sieht,
// warum's nicht durchging, aber 200 weil DB-State sich nicht ändert.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { sendStayPush } from '@retaha/wallet';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { stay_id?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.stay_id) return json({ ok: false, error: 'missing_stay_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'operations.write');
  if (auth instanceof Response) return auth;

  // Stay muss zu diesem Hotel gehören
  const sb = createSupabaseServiceRoleInstance();
  const { data: stay } = await sb
    .from('stays').select('id, hotel_id').eq('id', body.stay_id).maybeSingle();
  if (!stay || stay.hotel_id !== hotel.id) {
    return json({ ok: false, error: 'stay_not_found' }, 404);
  }

  const result = await sendStayPush(body.stay_id, 'room_ready');
  return json({ ok: true, result });
};
