/**
 * Astro Middleware — Sprach-Detection + Cross-Subdomain-Cookie-Sync
 *
 * Reihenfolge der Erkennung:
 *   1. URL-Prefix (z.B. /en/login) -> Astro.currentLocale wenn i18n.routing aktiv
 *   2. Cookie `retaha_lang` (cross-subdomain ueber .retaha.de gesetzt)
 *   3. Accept-Language Header (Browser-Default)
 *   4. Fallback: 'de'
 *
 * Liefert ergebnis in Astro.locals.currentLang (TS-deklariert in env.d.ts).
 */

import type { MiddlewareHandler } from 'astro';

const SUPPORTED = ['de', 'en', 'tr', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'] as const;
type Lang = (typeof SUPPORTED)[number];

function isLang(value: string | undefined): value is Lang {
  return !!value && (SUPPORTED as readonly string[]).includes(value);
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  // 1. URL-Prefix via Astro i18n
  const urlLocale = context.currentLocale;

  // 2. Cookie
  const cookieLang = context.cookies.get('retaha_lang')?.value;

  // 3. Accept-Language
  const acceptLanguage = context.request.headers.get('accept-language');
  const browserLang = acceptLanguage?.split(',')[0]?.split('-')[0]?.toLowerCase();

  // Priority-Cascade: URL > Cookie > Browser > Default
  let finalLang: Lang = 'de';
  if (isLang(urlLocale)) {
    finalLang = urlLocale;
  } else if (isLang(cookieLang)) {
    finalLang = cookieLang;
  } else if (isLang(browserLang)) {
    finalLang = browserLang;
  }

  // Inject in locals fuer Pages
  context.locals.currentLang = finalLang;

  return next();
};
