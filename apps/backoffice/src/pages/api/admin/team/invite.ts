// Sprint Functional Modul A Phase 3 — Team-Mitglied einladen
//
// POST /api/admin/team/invite
// Body: { email, role: 'manager'|'staff' }
// Permission: team.invite (owner + manager)
//
// Flow:
//   1. Permission-Check + Validation
//   2. Magic-Link an die Email via Supabase Auth signInWithOtp({ shouldCreateUser: true })
//      → Supabase legt den User automatisch an wenn neu, schickt Login-Link
//   3. hotel_users-Insert mit accepted_at=NULL (pending)
//      → Beim Klick auf den Magic-Link landet der User in auth/callback, wird
//        eingeloggt und seine offenen Invites werden dort per Lazy-Accept
//        akzeptiert (finalizeLoginSession, Service-Role, user_id + accepted_at
//        IS NULL). Kein separater Accept-Endpoint nötig.

import type { APIRoute } from 'astro';
import {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  getUserHotels,
} from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { isRole, type Role } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { email?: string; role?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role?.trim() as Role;
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (!isRole(role) || role === 'owner') return json({ ok: false, error: 'invalid_role', message: 'Owner kann nicht eingeladen werden.' }, 400);

  // Hotel-Kontext: nimm das (einzige) Hotel des Inviters
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  // Permission-Check
  const auth = await requirePermission(cookies, request, hotel.id, 'team.invite');
  if (auth instanceof Response) return auth;

  const admin = createSupabaseServiceRoleInstance();

  // Existierenden User in auth.users finden (Edge-Case: Email schon registriert)
  const { data: existingUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existingUser?.users?.find(u => u.email?.toLowerCase() === email);

  // Magic-Link triggern (signInWithOtp creates user if not exists).
  // emailRedirectTo MUSS auf den Auth-App-Callback zeigen — nur dort wird der
  // Token getauscht, die Cross-Subdomain-Session gesetzt und rollenrichtig
  // gelandet (staff → Dashboard). Vorher: backoffice/admin = Route ohne
  // Token-Handler → der Eingeladene wurde nie eingeloggt.
  const authAppUrl = import.meta.env.AUTH_APP_URL ?? 'https://auth.retaha.de';
  const userClient = createSupabaseServerInstance(cookies, request);
  const { error: otpErr } = await userClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${authAppUrl}/callback`,
    },
  });
  if (otpErr) {
    console.error('[team/invite] signInWithOtp failed:', otpErr);
    return json({ ok: false, error: 'invite_email_failed', detail: otpErr.message }, 502);
  }

  // hotel_users-Insert mit accepted_at=NULL (pending)
  // user_id ist erstmal NULL falls neuer User — wir resolven beim Accept.
  // Workaround: wenn User schon existiert, direkt user_id setzen.
  // Wenn neu: User existiert nach signInWithOtp in auth.users — re-fetch.
  let userId = found?.id;
  if (!userId) {
    const { data: refresh } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = refresh?.users?.find(u => u.email?.toLowerCase() === email)?.id;
  }
  if (!userId) {
    return json({ ok: false, error: 'user_resolve_failed' }, 500);
  }

  // Idempotent INSERT (UNIQUE auf user_id,hotel_id)
  const { error: insErr } = await admin.from('hotel_users').upsert({
    user_id: userId,
    hotel_id: hotel.id,
    role,
    invited_by: auth.userId,
    invited_at: new Date().toISOString(),
    accepted_at: null,
  }, { onConflict: 'user_id,hotel_id', ignoreDuplicates: false });

  if (insErr) {
    console.error('[team/invite] insert failed:', insErr);
    return json({ ok: false, error: 'insert_failed', detail: insErr.message }, 500);
  }

  return json({ ok: true, email, role, hotel_id: hotel.id });
};
