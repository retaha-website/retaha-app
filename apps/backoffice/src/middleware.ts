/**
 * backoffice.retaha.de Middleware — SSO-Guard.
 *
 * Prüft Cross-Subdomain-Session-Cookie. Wenn fehlt: 302 zu auth.retaha.de/login.
 *
 * Public-Routes-Whitelist:
 *   - /api/webhooks/*    (externe Webhooks z.B. Stripe, falls in backoffice)
 *   - /api/health        (Health-Check)
 *   - /api/cron/*        (Vercel-Cron-Trigger via CRON_SECRET header)
 *   - /admin/login       (eigene Login-Page, fallback wenn SSO down)
 *   - /admin/auth/*      (Legacy Login/Logout-Endpoints)
 *   - /onboarding/*      (Self-Service-Onboarding — public bis Hotelier-Setup fertig)
 *
 * Beim Hit auf protected route:
 *   1. Token aus Cookie via getSessionToken()
 *   2. Wenn vorhanden → next()
 *   3. Wenn fehlt → buildLoginRedirect(currentUrl) → 302
 */

import { defineMiddleware } from 'astro:middleware';
import { getSessionToken, buildLoginRedirect } from '@retaha/auth';

const PUBLIC_PATTERNS = [
  /^\/api\/webhooks\//,
  /^\/api\/stripe\//,
  /^\/api\/health$/,
  /^\/api\/cron\//,
  /^\/admin\/login$/,
  /^\/admin\/auth\//,
  /^\/onboarding\//,
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
