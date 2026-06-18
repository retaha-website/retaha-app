/**
 * Session-Timeout-Auflösung — macht hotels.session_timeout_hours real.
 *
 * Hintergrund: drei feste Zeit-Mechanismen, keiner hing bisher am Setting:
 *   - Session-Cookie retaha_session → fix 7 Tage
 *   - MFA-Marker retaha_mfa → fix 12h
 *   - Supabase-JWT → ~Config, KEIN Refresh → bei exp Re-Login erzwungen
 *
 * Entscheidung (ii): session_timeout_hours wirkt als VERKÜRZUNG, ehrlich gemacht:
 *   - Cookie-maxAge = Timeout, zur Laufzeit auf die JWT-exp gedeckelt (nie still
 *     verlängern — ohne Refresh kann die Session den JWT nicht überleben).
 *   - Marker-TTL = min(12h, Timeout, Session-Rest) — Marker überlebt die Session NIE
 *     (sonst überspränge eine Re-Login im alten Marker-Fenster die Challenge).
 *   - 0 = kein Timeout (langer Default, ebenfalls JWT-gedeckelt).
 *
 * Alles fail-safe: jeder Fehler → 0 (= bisheriges Default-Verhalten).
 * Hotel-level; bei Multi-Hotel die RESTRIKTIVSTE (kürzeste) Policy.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_TIMEOUT_OPTIONS = [0, 1, 2, 4, 8, 24] as const;
const DEFAULT_HOURS = 0; // 0 = kein Timeout
const NO_TIMEOUT_COOKIE_SECONDS = 7 * 24 * 60 * 60; // 7d für "0"
const MARKER_HARD_CAP_SECONDS = 12 * 60 * 60; // Marker nie > 12h

/** Validiert/normalisiert auf die erlaubten Stufen; alles andere → Default (0). */
export function clampTimeoutHours(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return (SESSION_TIMEOUT_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_HOURS;
}

/**
 * Liest die restriktivste session_timeout_hours über alle Hotels des Users.
 * Service-Role-Client (bypassed RLS). Fail-safe: jeder Fehler → 0 (kein Timeout).
 */
export async function getSessionTimeoutHours(
  service: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    const { data } = await service
      .from('hotel_users')
      .select('hotels(session_timeout_hours)')
      .eq('user_id', userId);

    const positives = (data ?? [])
      .map((r: any) => clampTimeoutHours(r?.hotels?.session_timeout_hours))
      .filter((h: number) => h > 0);

    if (positives.length === 0) return 0; // alle 0 → kein Timeout
    return Math.min(...positives); // restriktivste (kürzeste) Policy
  } catch {
    return DEFAULT_HOURS;
  }
}

/** Liest die exp-Claim (Epoch-Sekunden) aus einem JWT — ohne Verifikation (eigenes Cookie). */
export function decodeJwtExp(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp : undefined;
  } catch {
    return undefined;
  }
}

function jwtRemainingSeconds(jwtExpEpoch?: number): number | undefined {
  if (!jwtExpEpoch) return undefined;
  const now = Math.floor(Date.now() / 1000);
  const remaining = jwtExpEpoch - now;
  return remaining > 0 ? remaining : undefined;
}

/** Cookie-maxAge (Sekunden): Timeout (oder 7d bei 0), gedeckelt auf die JWT-exp. */
export function resolveSessionCookieMaxAge(hours: number, jwtExpEpoch?: number): number {
  const base = hours > 0 ? hours * 3600 : NO_TIMEOUT_COOKIE_SECONDS;
  const jwtRemaining = jwtRemainingSeconds(jwtExpEpoch);
  return jwtRemaining ? Math.min(base, jwtRemaining) : base;
}

/** Marker-TTL (Sekunden): min(12h, Timeout, Session-Rest). Überlebt die Session nie. */
export function resolveMarkerTtl(hours: number, jwtExpEpoch?: number): number {
  const byTimeout = hours > 0 ? hours * 3600 : MARKER_HARD_CAP_SECONDS;
  let ttl = Math.min(MARKER_HARD_CAP_SECONDS, byTimeout);
  const jwtRemaining = jwtRemainingSeconds(jwtExpEpoch);
  if (jwtRemaining) ttl = Math.min(ttl, jwtRemaining);
  return ttl;
}
