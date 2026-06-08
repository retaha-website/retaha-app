import { defineMiddleware } from 'astro:middleware';

// Subdomains die KEIN Hotel-Slug sind
const SYSTEM_SUBDOMAINS = new Set(['app', 'www', 'api', 'mail', 'smtp', 'ftp']);
const DOMAIN_SUFFIX = '.retaha.de';
const MAIN_HOST    = 'app.retaha.de';

const FRAME_ANCESTORS_CSP = "frame-ancestors 'self' https://backoffice.retaha.de https://*.retaha.de";

export const onRequest = defineMiddleware(async (context, next) => {
  const host     = context.request.headers.get('host') ?? '';
  const hostname = host.split(':')[0]; // Port abschneiden

  // Kein Hotel-Subdomain → normal weiter (aber CSP-Header trotzdem setzen)
  if (
    hostname === MAIN_HOST ||
    !hostname.endsWith(DOMAIN_SUFFIX)
  ) {
    const res = await next();
    res.headers.set('Content-Security-Policy', FRAME_ANCESTORS_CSP);
    return res;
  }

  const subdomain = hostname.slice(0, hostname.length - DOMAIN_SUFFIX.length);
  if (!subdomain || SYSTEM_SUBDOMAINS.has(subdomain)) {
    const res = await next();
    res.headers.set('Content-Security-Policy', FRAME_ANCESTORS_CSP);
    return res;
  }

  // Hotel-Subdomain erkannt (z.B. "thegategarden")
  // /{token}             → /g/{token}
  // /{token}/checkout    → /g/{token}/checkout
  // /                    → Weiterleiten zu app.retaha.de (kein standalone-Root)
  const url      = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') {
    return context.redirect(`https://${MAIN_HOST}`, 302);
  }

  // Pfade die schon /g/ oder /api/ haben — unverändert lassen
  if (pathname.startsWith('/g/') || pathname.startsWith('/api/') || pathname.startsWith('/_')) {
    const res = await next();
    res.headers.set('Content-Security-Policy', FRAME_ANCESTORS_CSP);
    return res;
  }

  // /{token}[/...] → /g/{token}[/...]
  const rewriteUrl = new URL(url);
  rewriteUrl.pathname = `/g${pathname}`;
  const res = await context.rewrite(rewriteUrl);
  res.headers.set('Content-Security-Policy', FRAME_ANCESTORS_CSP);
  return res;
});
