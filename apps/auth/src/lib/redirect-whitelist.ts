/**
 * URL-Whitelist für return_to-Parameter im SSO-Flow.
 *
 * Verhindert Open-Redirect-Vulnerability (CWE-601): Angreifer könnte
 *   /login?return_to=https://evil.com
 * an Opfer schicken, die ihre Credentials eingeben und dann zu evil.com
 * weitergeleitet werden (mit Session-Cookie? → CSRF/Phishing).
 *
 * Regel: return_to muss zu einer der erlaubten Hotelier-Apps oder
 * dem dev-Domain-Pattern passen. Sonst → Default-Redirect zu Backoffice.
 *
 * ENV: ALLOWED_REDIRECT_DOMAINS — Komma-getrennte Domain-Liste
 *   Default Production: app.retaha.de,dashboard.retaha.de,backoffice.retaha.de
 *   Dev: app.retaha.local,dashboard.retaha.local,backoffice.retaha.local
 */

import { getEnv } from '@retaha/db';

const DEFAULT_ALLOWED = [
  'app.retaha.de',
  'dashboard.retaha.de',
  'backoffice.retaha.de',
];

const DEV_ALLOWED = [
  'app.retaha.local',
  'dashboard.retaha.local',
  'backoffice.retaha.local',
  'localhost',
  '127.0.0.1',
];

function getAllowedHosts(): string[] {
  const fromEnv = getEnv('ALLOWED_REDIRECT_DOMAINS');
  if (fromEnv) {
    return fromEnv.split(',').map(s => s.trim()).filter(Boolean);
  }
  const isProd =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) ||
    getEnv('NODE_ENV') === 'production';
  return isProd ? DEFAULT_ALLOWED : [...DEFAULT_ALLOWED, ...DEV_ALLOWED];
}

export function defaultRedirectTarget(): string {
  return getEnv('DEFAULT_REDIRECT_TARGET') ?? 'https://backoffice.retaha.de/overview';
}

/**
 * Validiert return_to URL. Returns die URL wenn sicher, sonst defaultRedirectTarget().
 *
 * Regeln:
 *   - return_to muss eine vollständige URL sein
 *   - Protokoll muss https sein (Ausnahme: http für *.retaha.local + localhost in Dev)
 *   - Host muss in der Whitelist sein (exact match, oder *.retaha.de Pattern)
 *   - Path-Anteil wird übernommen, Query + Fragment werden übernommen
 */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return defaultRedirectTarget();

  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    return defaultRedirectTarget();
  }

  const allowedHosts = getAllowedHosts();
  const isAllowed = allowedHosts.some(host => {
    if (parsed.hostname === host) return true;
    // Erlaube Sub-Subdomains in dev (z.B. retaha.local matched x.retaha.local)
    if (host.startsWith('*.') && parsed.hostname.endsWith(host.slice(1))) return true;
    return false;
  });

  if (!isAllowed) return defaultRedirectTarget();

  // Protokoll-Check: https außer Dev-Localhost
  const isDevHost =
    parsed.hostname.endsWith('.retaha.local') ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isDevHost) return defaultRedirectTarget();

  return parsed.toString();
}
