// Sprint Functional Modul A Phase 2 — requirePermission Helper für API-Endpoints
//
// Pattern:
//   export const POST = async ({ cookies, request }) => {
//     const auth = await requirePermission(cookies, request, hotelId, 'team.invite');
//     if (auth instanceof Response) return auth;  // 401/403 — Endpoint terminiert
//     // ... auth.userId, auth.role nutzen ...
//   }
//
// Liest die Rolle des Users für den gegebenen hotel_id. Wenn keine Membership:
// 403. Wenn keine User-Session: 401. Wenn Membership aber falsche Rolle: 403.

import type { AstroCookies } from 'astro';
import { createSupabaseServerInstance } from '../auth';
import { hasPermission, isRole, type Permission, type Role } from './permissions';

export interface PermissionContext {
  userId: string;
  role: Role;
  hotelId: string;
}

function json(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Auth-Check mit Permission-Gate. Returns PermissionContext bei Erfolg,
 * Response bei Auth/Permission-Fehler. Caller prüft via instanceof.
 */
export async function requirePermission(
  cookies: AstroCookies,
  request: Request,
  hotelId: string,
  permission: Permission,
): Promise<PermissionContext | Response> {
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ ok: false, error: 'unauthenticated' }, 401);

  const { data: membership } = await client
    .from('hotel_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('hotel_id', hotelId)
    .not('accepted_at', 'is', null)
    .maybeSingle();

  if (!membership || !isRole(membership.role)) {
    return json({ ok: false, error: 'no_membership' }, 403);
  }

  if (!hasPermission(membership.role, permission)) {
    return json({
      ok: false,
      error: 'insufficient_permission',
      required: permission,
      role: membership.role,
    }, 403);
  }

  return { userId: user.id, role: membership.role, hotelId };
}

/**
 * Convenience: nur die Rolle holen (für Read-Endpoints die selber filtern).
 * Returns null wenn nicht eingeloggt oder keine Membership.
 */
export async function getUserRole(
  cookies: AstroCookies,
  request: Request,
  hotelId: string,
): Promise<Role | null> {
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client
    .from('hotel_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('hotel_id', hotelId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  return isRole(data?.role) ? data.role : null;
}
