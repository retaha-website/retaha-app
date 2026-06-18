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
import { getSessionToken, buildLoginRedirect, getUser } from '@retaha/auth';
import { isMfaMarkerConfigured, verifyMfaMarker } from '@retaha/auth/mfa';

const PUBLIC_PATTERNS = [
  /^\/api\/webhooks\//,
  /^\/api\/health$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some(re => re.test(pathname));
}

const AUTH_APP_URL = import.meta.env.AUTH_APP_URL ?? 'https://auth.retaha.de';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request } = context;

  if (isPublic(url.pathname)) {
    return next();
  }

  const token = getSessionToken(cookies);
  if (!token) {
    return Response.redirect(buildLoginRedirect(url), 302);
  }

  // MFA-Login-Challenge — kein gültiger, signierter Marker → /mfa (auth-App).
  // Marker-only (Dashboard hat bewusst KEINE Service-Role — least privilege);
  // /mfa entscheidet, ob wirklich gechallengt wird (MFA aktiv) oder nur der Marker
  // gesetzt + durchgewunken wird (kein MFA). Gated auf das Secret (fail-open),
  // getUser nur wenn das Feature aktiv ist. API-Routen nicht umleiten (Logout etc.).
  if (isMfaMarkerConfigured() && !url.pathname.startsWith('/api/')) {
    const user = await getUser(cookies, request);
    if (!user) {
      return Response.redirect(buildLoginRedirect(url), 302);
    }
    if (!verifyMfaMarker(cookies, user.id)) {
      const mfaUrl = `${AUTH_APP_URL}/mfa?return_to=${encodeURIComponent(url.toString())}`;
      return Response.redirect(mfaUrl, 302);
    }
  }

  return next();
});
