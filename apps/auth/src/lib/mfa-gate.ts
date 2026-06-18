/**
 * Login-Session-Finalisierung — setzt nach erfolgreicher Auth den Session-Cookie
 * (Timeout-bewusst) UND den MFA-Marker konsistent.
 *
 * Session-Cookie-maxAge = session_timeout_hours, zur Laufzeit auf die JWT-exp
 * gedeckelt (ohne Refresh kann die Session den JWT nicht überleben → keine
 * stille Verlängerung). 0 = kein Timeout (7d-Default, ebenfalls gedeckelt).
 *
 * MFA-Marker:
 *   - Feature aus (kein MFA_MARKER_SECRET) → kein Marker.
 *   - User ohne MFA → Marker setzen (kein Challenge; vermeidet Flächen-Bounce).
 *   - Magic-Link + require_on_magic_link=false → Marker setzen (Magic-Link genügt).
 *   - sonst (MFA aktiv, Challenge nötig) → KEIN Marker → Flächen-Gate → /mfa.
 *   - Marker-TTL = min(12h, Timeout, Session-Rest) → überlebt die Session nie.
 *
 * Alles fail-safe: jeder Fehler → bisheriges Default-Verhalten, Login bricht nie.
 */

import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  setSessionCookie,
  createSupabaseServiceRoleInstance,
  getSessionTimeoutHours,
  decodeJwtExp,
  resolveSessionCookieMaxAge,
  resolveMarkerTtl,
} from '@retaha/auth';
import { isMfaMarkerConfigured, setMfaMarkerCookie } from '@retaha/auth/mfa';

interface LoginCtx {
  service: SupabaseClient;
  userId: string;
  hours: number;
  jwtExp?: number;
}

async function applyLoginMfaMarker(
  cookies: AstroCookies,
  isMagicLink: boolean,
  ctx: LoginCtx,
): Promise<void> {
  if (!isMfaMarkerConfigured()) return;
  const { service, userId, hours, jwtExp } = ctx;
  if (!userId) return;

  try {
    const { data: mfa } = await service
      .from('user_mfa')
      .select('enabled, require_on_magic_link')
      .eq('user_id', userId)
      .maybeSingle();

    const enabled = !!mfa?.enabled;
    const requireOnMagicLink = !!mfa?.require_on_magic_link;
    const ttl = resolveMarkerTtl(hours, jwtExp);

    if (!enabled) {
      setMfaMarkerCookie(cookies, userId, ttl);
      return;
    }
    if (isMagicLink && !requireOnMagicLink) {
      setMfaMarkerCookie(cookies, userId, ttl);
      return;
    }
    // sonst: MFA aktiv + Challenge nötig → Marker NICHT setzen.
  } catch {
    // fail-open
  }
}

/**
 * Setzt Session-Cookie (Timeout-bewusst) + MFA-Marker. Ersetzt den direkten
 * setSessionCookie-Aufruf in den Login-Pfaden.
 */
export async function finalizeLoginSession(
  cookies: AstroCookies,
  accessToken: string,
  userId: string,
  isMagicLink: boolean,
): Promise<void> {
  const jwtExp = decodeJwtExp(accessToken);

  // Service-Role kann werfen (fehlende Env) — Login darf NIE daran brechen.
  let service: SupabaseClient | null = null;
  try {
    service = createSupabaseServiceRoleInstance();
  } catch {
    service = null;
  }

  let hours = 0;
  if (service) {
    try {
      hours = await getSessionTimeoutHours(service, userId);
    } catch {
      hours = 0; // fail-safe: kein Timeout
    }
  }

  // Cookie immer setzen (auch im Fallback — maxAge = min(7d, JWT-Rest) ist
  // mindestens so eng wie bisher, nie länger).
  setSessionCookie(cookies, accessToken, {
    maxAgeSeconds: resolveSessionCookieMaxAge(hours, jwtExp),
  });

  if (service) {
    await applyLoginMfaMarker(cookies, isMagicLink, { service, userId, hours, jwtExp });
  }
}
