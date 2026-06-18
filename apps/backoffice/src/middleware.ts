/**
 * backoffice.retaha.de Middleware — SSO-Guard + RBAC-Surface-Gate + 2FA-Enforcement.
 *
 * Reihenfolge pro Request (nicht-public Routes):
 *   1. Session-Token vorhanden? sonst → auth.retaha.de/login
 *   2. Rollen serverseitig laden (RLS self-read → nur eigene Memberships)
 *   3. SURFACE-GATE: nur owner/manager dürfen ins Backoffice. staff (oder jede
 *      Rolle ohne BO-Zugriff) wird zum Dashboard umgeleitet — auch bei direkt
 *      eingetippter URL. UI-Ausblenden ist Kosmetik; DIES ist die Durchsetzung.
 *   4. 2FA-FORCE-SETUP: hat der Owner mfa_required_for_team gesetzt und der User
 *      hat noch kein MFA → Redirect auf /profil?required=true (Setup erzwingen).
 *
 * Fail closed: unbekannte/fehlende Rolle bzw. Token-Fehler → geringste Rechte
 * (Login bzw. Dashboard), nie Backoffice.
 *
 * Public-Routes-Whitelist (kein Auth/Role-Check):
 *   /api/webhooks/*, /api/stripe/*, /api/health, /api/cron/*, /admin/login,
 *   /admin/auth/*, /onboarding/*, /api/marketing/consent/*, /api/marketing/track/*
 */

import { defineMiddleware } from 'astro:middleware';
import {
  getSessionToken,
  buildLoginRedirect,
  getUser,
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  anyRoleCanAccessSurface,
  isRole,
  type Role,
} from '@retaha/auth';
import { getUserMfaStatus, getHotelMfaPolicy, shouldForceSetup } from '@retaha/auth/mfa';

const PUBLIC_PATTERNS = [
  /^\/api\/webhooks\//,
  /^\/api\/stripe\//,
  /^\/api\/health$/,
  /^\/api\/cron\//,
  /^\/admin\/login$/,
  /^\/admin\/auth\//,
  /^\/onboarding\//,
  /^\/api\/marketing\/consent\//,
  /^\/api\/marketing\/track\//,
];

// Vom 2FA-Force-Setup-Redirect ausgenommen — sonst Redirect-Loop bzw. der User
// muss Setup/Logout erreichen können. /profil ist das Redirect-Ziel selbst.
const MFA_EXEMPT_PATTERNS = [
  /^\/profil/,
  /^\/api\//,
  /^\/admin\/auth\//,
  /^\/admin\/login$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some(re => re.test(pathname));
}
function isMfaExempt(pathname: string): boolean {
  return MFA_EXEMPT_PATTERNS.some(re => re.test(pathname));
}

const DASHBOARD_URL = import.meta.env.DASHBOARD_URL ?? 'https://dashboard.retaha.de';

function jsonForbidden(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'surface_forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request } = context;

  if (isPublic(url.pathname)) {
    return next();
  }

  const token = getSessionToken(cookies);
  if (!token) {
    return Response.redirect(buildLoginRedirect(url), 302);
  }

  // Identität explizit validieren (JWT). Ungültig/abgelaufen → zurück zum Login.
  const user = await getUser(cookies, request);
  if (!user) {
    return Response.redirect(buildLoginRedirect(url), 302);
  }

  // Eigene Memberships — auf user_id gefiltert (NICHT auf RLS-self-read verlassen:
  // die Owner-Read-Policy würde sonst das ganze Team zurückgeben).
  const client = createSupabaseServerInstance(cookies, request);
  const { data: rows, error } = await client
    .from('hotel_users')
    .select('role, hotel_id')
    .eq('user_id', user.id);

  if (error) {
    return Response.redirect(buildLoginRedirect(url), 302);
  }

  const memberships = rows ?? [];
  const roles = memberships.map((m: { role: unknown }) => m.role).filter(isRole) as Role[];

  // SURFACE-GATE — Backoffice nur für owner/manager.
  if (roles.length > 0 && !anyRoleCanAccessSurface(roles, 'backoffice')) {
    if (url.pathname.startsWith('/api/')) return jsonForbidden();
    return Response.redirect(DASHBOARD_URL, 302);
  }

  // 2FA-FORCE-SETUP — Hotel-Pflicht + User ohne MFA → Setup erzwingen.
  if (roles.length > 0 && !isMfaExempt(url.pathname)) {
    const hotelId = memberships[0]?.hotel_id as string | undefined;
    if (hotelId) {
      const service = createSupabaseServiceRoleInstance();
      const [mfaStatus, policy] = await Promise.all([
        getUserMfaStatus(service, user.id),
        getHotelMfaPolicy(service, hotelId),
      ]);
      if (shouldForceSetup(mfaStatus, policy)) {
        return Response.redirect(new URL('/profil?required=true', url.origin).toString(), 302);
      }
    }
  }

  return next();
});
