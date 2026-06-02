/**
 * Cross-Subdomain Session-Cookie für SSO via auth.retaha.de.
 *
 * Sprint F · Phase B.2 — NEUE Funktionalität.
 *
 * Cookie-Pattern:
 *   - Name:     'retaha_session' (Hotelier-Session)
 *   - Domain:   .retaha.de (Punkt-Prefix → gilt für ALLE Subdomains)
 *   - HttpOnly: true (kein JS-Zugriff)
 *   - Secure:   true (nur HTTPS)
 *   - SameSite: 'lax' (Cross-Subdomain ok, Cross-Site nein)
 *   - Path:     /
 *   - Max-Age:  7 Tage (refresh durch Supabase-Auth)
 *
 * Auth-Flow:
 *   1. Hotelier landet auf dashboard.retaha.de → kein Cookie
 *   2. Middleware → 302 auth.retaha.de/login?return_to=...
 *   3. Magic-Link → auth.retaha.de/callback verifies + setSessionCookie()
 *   4. Cookie ist auf .retaha.de gesetzt → gilt auf dashboard/backoffice/etc.
 *   5. 302 zu return_to
 *
 * Gast-Frontend (app.retaha.de) ist NICHT betroffen: das nutzt
 * JWT-Stay-Tokens via URL, kein Hotelier-Session-Cookie.
 *
 * ENV:
 *   COOKIE_DOMAIN  — default '.retaha.de' für Production, '.retaha.local' für Dev
 *
 * SECURITY:
 *   - Verlangt HTTPS in Production (Secure-Flag)
 *   - HttpOnly verhindert XSS-Token-Diebstahl
 *   - SameSite=Lax verhindert CSRF (Cross-Site-Submit blockt)
 */

import type { AstroCookies } from 'astro';
import { getEnv } from '@retaha/db';

export const SESSION_COOKIE_NAME = 'retaha_session';
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

export interface SessionCookieOptions {
  /** Override-Default: liest sonst aus COOKIE_DOMAIN env. */
  domain?: string;
  /** Override-Default: 7 Tage. */
  maxAgeSeconds?: number;
}

function resolveCookieDomain(override?: string): string {
  if (override) return override;
  const envDomain = getEnv('COOKIE_DOMAIN');
  if (envDomain) return envDomain;
  // Production-Fallback. In Dev: in .env COOKIE_DOMAIN=.retaha.local setzen.
  return '.retaha.de';
}

function isProductionEnv(): boolean {
  // Vite/Astro: import.meta.env.PROD ist Build-time-Flag
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) return true;
  // Node-Standalone: NODE_ENV
  return getEnv('NODE_ENV') === 'production';
}

/**
 * Setze das Cross-Subdomain Session-Cookie auf Astro-Response.
 *
 * Wird in auth.retaha.de/callback aufgerufen nachdem Magic-Link verifiziert ist.
 * Token ist der Supabase-Auth-Token (refresh- + access-token zusammen, oder JWT).
 */
export function setSessionCookie(
  cookies: AstroCookies,
  token: string,
  options: SessionCookieOptions = {},
): void {
  cookies.set(SESSION_COOKIE_NAME, token, {
    domain: resolveCookieDomain(options.domain),
    path: '/',
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: 'lax',
    maxAge: options.maxAgeSeconds ?? SEVEN_DAYS_SECONDS,
  });
}

/**
 * Lösche das Cross-Subdomain Session-Cookie. Logout-Aktion.
 *
 * Wichtig: gleiche domain wie beim Setzen, sonst löscht der Browser nichts.
 */
export function clearSessionCookie(
  cookies: AstroCookies,
  options: SessionCookieOptions = {},
): void {
  cookies.delete(SESSION_COOKIE_NAME, {
    domain: resolveCookieDomain(options.domain),
    path: '/',
  });
}

/**
 * Liest den Session-Token aus dem Cookie (oder undefined).
 *
 * Middleware-Helper. Apps die Hotelier-Auth brauchen (dashboard, backoffice)
 * rufen das in ihrer middleware.ts auf — wenn undefined: 302 zu auth-App.
 */
export function getSessionToken(cookies: AstroCookies): string | undefined {
  const v = cookies.get(SESSION_COOKIE_NAME)?.value;
  return v && v.length > 0 ? v : undefined;
}

/**
 * Baue Auth-App Login-URL mit return_to Parameter.
 *
 * Verwendung in Middleware:
 *   if (!getSessionToken(cookies)) {
 *     return Astro.redirect(buildLoginRedirect(Astro.url));
 *   }
 */
export function buildLoginRedirect(currentUrl: URL): string {
  const authAppUrl = getEnv('AUTH_APP_URL') ?? 'https://auth.retaha.de';
  const returnTo = encodeURIComponent(currentUrl.toString());
  return `${authAppUrl}/login?return_to=${returnTo}`;
}
