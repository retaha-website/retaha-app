/**
 * MFA-Session-Marker — „diese Browser-Session hat die 2FA-Challenge bestanden".
 *
 * Schritt 0 des Per-Login-MFA-Briefings: ein SERVERSEITIG VERTRAUENSWÜRDIGER
 * Marker, den alle Flächen (auth/backoffice/dashboard) honorieren.
 *
 * Eigenschaften:
 *   - SIGNIERT (HMAC-SHA256) + an die user_id gebunden → nicht client-fälschbar,
 *     nicht auf anderen User übertragbar (Shared-Device).
 *   - Cookie gescopet auf `.retaha.de` (COOKIE_DOMAIN) → cross-subdomain wie die
 *     Session. (Der alte `mfa_verified='true'`-Cookie war host-scoped + unsigniert.)
 *   - HttpOnly + Secure(prod) + SameSite=Lax. Stateless → KEINE Migration.
 *   - TTL 12h.
 *
 * Fail-open by design: ist MFA_MARKER_SECRET nicht gesetzt, ist das Feature AUS
 * (set = no-op, isMfaMarkerConfigured = false → Middleware überspringt das Gate).
 * Verhindert Lockout/Endlosschleifen bei unvollständiger Env-Provisionierung.
 *
 * ENV: MFA_MARKER_SECRET (>= 16 Zeichen) — in auth + backoffice + dashboard.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { getEnv } from '@retaha/db';

export const MFA_MARKER_COOKIE = 'retaha_mfa';
const TTL_SECONDS = 12 * 60 * 60; // 12h

function getSecret(): string | null {
  const s = getEnv('MFA_MARKER_SECRET');
  return s && s.length >= 16 ? s : null;
}

/** Ist das Marker-Feature konfiguriert? Gates müssen darauf prüfen (fail-open). */
export function isMfaMarkerConfigured(): boolean {
  return getSecret() !== null;
}

function resolveCookieDomain(): string {
  return getEnv('COOKIE_DOMAIN') ?? '.retaha.de';
}

function isProductionEnv(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) return true;
  return getEnv('NODE_ENV') === 'production';
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Token-Format: `<userId>.<expEpochSec>.<sig>`, sig = HMAC(userId.exp). */
function buildToken(userId: string, secret: string, ttlSeconds = TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Setzt den signierten Marker (no-op wenn Feature nicht konfiguriert). */
export function setMfaMarkerCookie(cookies: AstroCookies, userId: string): void {
  const secret = getSecret();
  if (!secret || !userId) return;
  cookies.set(MFA_MARKER_COOKIE, buildToken(userId, secret), {
    domain: resolveCookieDomain(),
    path: '/',
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: 'lax',
    maxAge: TTL_SECONDS,
  });
}

/** Löscht den Marker (Logout / Disable). Gleiche domain wie beim Setzen. */
export function clearMfaMarkerCookie(cookies: AstroCookies): void {
  cookies.delete(MFA_MARKER_COOKIE, {
    domain: resolveCookieDomain(),
    path: '/',
  });
}

/**
 * Verifiziert den Marker für DIESEN User. true nur bei: gültige Signatur UND
 * userId-Bindung UND nicht abgelaufen. Caller sollte vorher isMfaMarkerConfigured
 * prüfen — ohne Secret gibt das hier immer false zurück.
 */
export function verifyMfaMarker(cookies: AstroCookies, userId: string): boolean {
  const secret = getSecret();
  if (!secret || !userId) return false;

  const raw = cookies.get(MFA_MARKER_COOKIE)?.value;
  if (!raw) return false;

  const parts = raw.split('.');
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;

  if (uid !== userId) return false; // an anderen User gebunden

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false; // abgelaufen

  const expected = sign(`${uid}.${expStr}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
