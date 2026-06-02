// Sprint Legal/DSGVO Phase 2 — Consent-Helpers
//
// IP-Hash: SHA-256(IP + STAY_SESSION_SECRET). DSGVO-Nachweis ohne Klartext-IP.
// Wenn STAY_SESSION_SECRET fehlt: fallback fixed salt + Warn-Log (sollte in
// Production NIE vorkommen — Secret ist Hard-Requirement seit Sprint D Phase 3).
//
// Policy-Version: bei jeder substantiellen Änderung der Datenschutzerklärung
// hochzählen → Frontend triggert Re-Consent bei abweichender Version im
// gespeicherten Banner-Flag (zukünftiges Feature).

import { createHash } from 'node:crypto';
import { getEnv } from '@retaha/db';

/** Aktuelle Datenschutz-Policy-Version. Bei substantieller Änderung hochzählen. */
export const POLICY_VERSION = '2026-06-01';

/** Valide Consent-Typen (Schema-Constraint in consent_log). */
export const CONSENT_TYPES = ['necessary', 'analytics', 'all', 'rejected', 'updated'] as const;
export type ConsentType = typeof CONSENT_TYPES[number];

const FALLBACK_SALT = 'retaha-consent-fallback-salt-do-not-rely-on';

/**
 * Hasht eine IP mit Server-Salt. Reverse-Engineering nicht möglich ohne Salt.
 * Erlaubt Wiedererkennung wiederholter Consent-Wechsel vom selben Nutzer
 * (zur Audit-Aggregation) ohne personenbezogene Klartext-IP.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip || !ip.trim()) return null;
  const salt = getEnv('STAY_SESSION_SECRET') ?? FALLBACK_SALT;
  if (salt === FALLBACK_SALT) {
    console.warn('[consent] STAY_SESSION_SECRET fehlt — IP-Hash nutzt Fallback-Salt. NICHT für Production!');
  }
  return createHash('sha256').update(ip.trim() + salt).digest('hex');
}

/**
 * Extrahiert die Client-IP aus den üblichen Request-Headers
 * (X-Forwarded-For von Vercel/Reverse-Proxy, X-Real-IP fallback).
 */
export function extractClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // erste IP in der Kette ist der Client (Rest sind Proxies)
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

export function isConsentType(value: unknown): value is ConsentType {
  return typeof value === 'string' && (CONSENT_TYPES as readonly string[]).includes(value);
}
