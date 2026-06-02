/**
 * dashboard.retaha.de Middleware — SSO-Guard.
 *
 * Prüft Cross-Subdomain-Session-Cookie. Wenn fehlt: 302 zu auth.retaha.de/login.
 *
 * Whitelist für public-Routes (Webhooks, Health):
 *   - /api/webhooks/*
 *   - /api/health
 *
 * Beim Hit auf protected route:
 *   1. Token aus Cookie via getSessionToken()
 *   2. Wenn vorhanden → next() (Token-Validity wird in den Pages via @supabase getUser geprüft)
 *   3. Wenn fehlt → buildLoginRedirect(currentUrl) → 302
 *
 * Note: Token-Refresh ist Sprint G/H Backlog — aktuell wird Token nur einmal
 * gesetzt (Magic-Link-Flow), nach Expiry muss User neu anfragen.
 */

import { defineMiddleware } from 'astro:middleware';
import { getSessionToken, buildLoginRedirect } from '@retaha/auth';

const PUBLIC_PATTERNS = [
  /^\/api\/webhooks\//,
  /^\/api\/health$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some(re => re.test(pathname));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies } = context;

  if (isPublic(url.pathname)) {
    return next();
  }

  const token = getSessionToken(cookies);
  if (!token) {
    return Response.redirect(buildLoginRedirect(url), 302);
  }

  return next();
});
