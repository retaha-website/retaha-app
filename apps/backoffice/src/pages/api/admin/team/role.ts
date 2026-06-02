// Sprint Functional Modul A Phase 3 — Rollen-Wechsel
//
// POST /api/admin/team/role
// Body: { member_id (hotel_users.id), new_role: 'manager'|'staff' }
// Permission: team.change_role (nur Owner)
//
// Schutz: Owner kann nicht zu Manager/Staff degradiert werden (das müsste
// in einem dedizierten "transfer_ownership"-Endpoint passieren — Backlog).
// Aktueller User kann sich selbst nicht degradieren.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { isRole, type Role } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { member_id?: string; new_role?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.member_id) return json({ ok: false, error: 'missing_member_id' }, 400);
  const newRole = body.new_role as Role;
  if (!isRole(newRole) || newRole === 'owner') {
    return json({ ok: false, error: 'invalid_role', message: 'Nur Manager oder Staff erlaubt. Owner-Transfer ist nicht implementiert.' }, 400);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'team.change_role');
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
    return json({ ok: false, error: 'cannot_demote_self' }, 400);
  }
  if (target.role === 'owner') {
    return json({ ok: false, error: 'cannot_change_owner_role' }, 400);
  }

  const { error } = await admin
    .from('hotel_users')
    .update({ role: newRole })
    .eq('id', body.member_id);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, member_id: body.member_id, new_role: newRole });
};
