// Sprint Functional Modul A Phase 3 — Team-Mitglied entfernen
//
// POST /api/admin/team/remove
// Body: { member_id (hotel_users.id) }
// Permission: team.remove (nur Owner)
//
// Schutz: Owner kann nicht entfernt werden (würde Hotel-Ownership verlieren).
// Aktueller User kann sich selbst nicht entfernen.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../lib/auth';
import { requirePermission } from '../../../../lib/auth/require-permission';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { member_id?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.member_id) return json({ ok: false, error: 'missing_member_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'team.remove');
  if (auth instanceof Response) return auth;

  const admin = createSupabaseServiceRoleInstance();
  const { data: target } = await admin
    .from('hotel_users')
    .select('id, user_id, role, hotel_id')
    .eq('id', body.member_id)
    .maybeSingle();
  if (!target || target.hotel_id !== hotel.id) {
    return json({ ok: false, error: 'member_not_found' }, 404);
  }
  if (target.user_id === auth.userId) {
    return json({ ok: false, error: 'cannot_remove_self' }, 400);
  }
  if (target.role === 'owner') {
    return json({ ok: false, error: 'cannot_remove_owner' }, 400);
  }

  const { error } = await admin
    .from('hotel_users')
    .delete()
    .eq('id', body.member_id);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, member_id: body.member_id });
};
