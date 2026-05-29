// Sprint D · Phase 3 — Stay-Session-Cookie (HS256 signed via jose)
//
// Konzept: Gast pairt sich einmalig (Pre-Arrival-Email, Backoffice-QR, oder
// Im-Zimmer-Fallback "Aufenthalt starten?") → wir setzen einen HS256-signed
// JWT als HttpOnly-Cookie. Bei /g/r/[room_code]-Zugriff wird der Cookie
// gegen die aktuelle Reservation im Zimmer validiert.
//
// Cookie-Name: retaha_stay
// Cookie-Flags: HttpOnly · SameSite=Lax · Path=/ · Secure in production
// Payload: { stay_id, hotel_id, exp } — exp = stay.check_out + 6h Toleranz
// Algorithmus: HS256 (explizit gesetzt, schützt vor alg=none-Confusion)

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { AstroCookies } from 'astro';
import { getEnv } from '../env';

const COOKIE_NAME = 'retaha_stay';
const ALGORITHM = 'HS256';
const ISSUER = 'retaha';
const AUDIENCE = 'guest-frontend';
const CHECK_OUT_TOLERANCE_HOURS = 6;

export interface StaySessionPayload {
  stay_id: string;
  hotel_id: string;
  exp: number;  // Unix-Timestamp (Sekunden)
}

function getSecret(): Uint8Array | null {
  const raw = getEnv('STAY_SESSION_SECRET');
  if (!raw || raw.length < 32) {
    console.warn('[stay-session] STAY_SESSION_SECRET fehlt oder < 32 chars — Pairing deaktiviert');
    return null;
  }
  return new TextEncoder().encode(raw);
}

/**
 * Signiert einen Stay-Session-JWT. exp = check_out + Toleranz (Standard 6h).
 * Returns null wenn Secret fehlt (Caller behandelt das gracefully).
 */
export async function signStaySession(params: {
  stay_id: string;
  hotel_id: string;
  check_out_utc: string;  // ISO-Datum
  toleranceHours?: number;
}): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const checkOutMs = Date.parse(params.check_out_utc);
  if (!Number.isFinite(checkOutMs)) {
    console.warn('[stay-session] check_out_utc invalid:', params.check_out_utc);
    return null;
  }
  const expSec = Math.floor((checkOutMs + (params.toleranceHours ?? CHECK_OUT_TOLERANCE_HOURS) * 3600 * 1000) / 1000);

  return new SignJWT({ stay_id: params.stay_id, hotel_id: params.hotel_id })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(secret);
}

/**
 * Verifiziert einen JWT-String. Returnt das Payload oder null bei jedem Fehler
 * (expired, bad signature, malformed, kein Secret).
 */
export async function verifyStaySession(jwt: string): Promise<StaySessionPayload | null> {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(jwt, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.stay_id !== 'string' || typeof payload.hotel_id !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return { stay_id: payload.stay_id, hotel_id: payload.hotel_id, exp: payload.exp };
  } catch (err) {
    // Erwartete Fehler still — JWTExpired, JWSSignatureVerificationFailed, etc.
    if (!(err instanceof joseErrors.JOSEError)) {
      console.warn('[stay-session] verify unexpected error:', (err as Error).message);
    }
    return null;
  }
}

/**
 * Liest den Cookie aus Astro.cookies und verifiziert ihn.
 * Returns null wenn kein Cookie, expired, oder Signatur-falsch.
 */
export async function getStaySession(cookies: AstroCookies): Promise<StaySessionPayload | null> {
  const cookie = cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifyStaySession(cookie.value);
}

/**
 * Setzt den Stay-Session-Cookie. Secure-Flag automatisch in production.
 */
export async function setStaySessionCookie(
  cookies: AstroCookies,
  params: { stay_id: string; hotel_id: string; check_out_utc: string },
): Promise<boolean> {
  const jwt = await signStaySession(params);
  if (!jwt) return false;

  const isProd = (getEnv('NODE_ENV') ?? '') === 'production';
  const checkOutMs = Date.parse(params.check_out_utc);
  const expiresAt = new Date(checkOutMs + CHECK_OUT_TOLERANCE_HOURS * 3600 * 1000);

  cookies.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return true;
}

/**
 * Löscht den Stay-Session-Cookie (Logout / Pairing-Reset / nach Check-out).
 */
export function clearStaySessionCookie(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export { COOKIE_NAME as STAY_COOKIE_NAME };

// ─── Pair-Token (Sprint D Phase 5) ─────────────────────────────────────
// Kurzlebiger Token (30 min) für QR-Code-Pairing aus dem Backoffice.
// Andere Audience als Stay-Session — verhindert Cross-Use (z.B. ein
// gestohlener Pair-Token darf nie als Stay-Session akzeptiert werden).

const PAIR_AUDIENCE = 'pair-link';
const PAIR_TTL_SECONDS_DEFAULT = 30 * 60;  // 30 Minuten (Backoffice-QR-Default)

export interface PairTokenPayload {
  stay_id: string;
  hotel_id: string;
  exp: number;
}

/**
 * Signiert einen Pair-Token mit konfigurierbarer TTL.
 *
 * - Backoffice-QR (Phase 5): ttlSeconds default = 30 min — kurz weil Hotelier
 *   den Code direkt vor dem Gast generiert.
 * - Pre-Arrival-Mail (Phase 6a): ttlSeconds = bis check_in_date + 1 Tag.
 *   Lang weil Gast die Mail Tage vorher öffnet.
 */
export async function signPairToken(params: {
  stay_id: string;
  hotel_id: string;
  ttlSeconds?: number;
}): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const ttl = Math.max(60, Math.floor(params.ttlSeconds ?? PAIR_TTL_SECONDS_DEFAULT));

  return new SignJWT({ stay_id: params.stay_id, hotel_id: params.hotel_id })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(PAIR_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
}

export async function verifyPairToken(jwt: string): Promise<PairTokenPayload | null> {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(jwt, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: PAIR_AUDIENCE,
    });
    if (typeof payload.stay_id !== 'string' || typeof payload.hotel_id !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return { stay_id: payload.stay_id, hotel_id: payload.hotel_id, exp: payload.exp };
  } catch (err) {
    if (!(err instanceof joseErrors.JOSEError)) {
      console.warn('[pair-token] verify unexpected error:', (err as Error).message);
    }
    return null;
  }
}
