/**
 * Astro Middleware — Sprach-Detection + URL-Rewrite + Cross-Subdomain-Cookie-Sync
 *
 * URL-Rewrite:
 *   /en/login -> intern /login mit currentLang='en'
 *   /tr/login -> intern /login mit currentLang='tr'
 *   etc. (alle 11 Sprachen)
 *
 *   Astro i18n routing macht das in SSR-Mode (Vercel-Adapter) nicht
 *   automatisch — wir machen es hier explizit via context.rewrite.
 *
 * Sprach-Cascade (fuer locals.currentLang):
 *   1. URL-Prefix (/en/, /tr/, etc.)
 *   2. Cookie `retaha_lang` (cross-subdomain ueber .retaha.de gesetzt)
 *   3. Accept-Language Header (Browser-Default)
 *   4. Fallback: 'de'
 *
 * Cookie-Sync: Bei URL-Lang-Prefix wird Cookie auf die URL-Sprache aktualisiert,
 * damit Folge-Apps (dashboard, backoffice) dieselbe Sprache uebernehmen.
 */

import type { MiddlewareHandler } from 'astro';

const SUPPORTED = ['de', 'en', 'tr', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'] as const;
type Lang = (typeof SUPPORTED)[number];

const LANG_PREFIX_REGEX = /^\/(de|en|tr|fr|es|it|pt|nl|ru|ar|zh)(?=\/|$)/;

function isLang(value: string | undefined): value is Lang {
  return !!value && (SUPPORTED as readonly string[]).includes(value);
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const url = new URL(context.request.url);

  // 1. URL-Lang-Prefix extrahieren (z.B. /en/login -> 'en' + '/login')
  const match = url.pathname.match(LANG_PREFIX_REGEX);
  const urlLang = match ? (match[1] as Lang) : undefined;
  const cleanPath = match
    ? url.pathname.replace(LANG_PREFIX_REGEX, '') || '/'
    : url.pathname;

  // 2. Cookie + Accept-Language fallbacks
  const cookieLang = context.cookies.get('retaha_lang')?.value;
  const acceptLanguage = context.request.headers.get('accept-language');
  const browserLang = acceptLanguage?.split(',')[0]?.split('-')[0]?.toLowerCase();

  // Cascade: URL > Cookie > Browser > Default
  let finalLang: Lang = 'de';
  if (urlLang) finalLang = urlLang;
  else if (isLang(cookieLang)) finalLang = cookieLang;
  else if (isLang(browserLang)) finalLang = browserLang;

  context.locals.currentLang = finalLang;

  // 3. Cookie sync: wenn URL-Sprache != Cookie, Cookie aktualisieren
  if (urlLang && urlLang !== cookieLang) {
    const host = url.hostname;
    const isProd = host.endsWith('.retaha.de') || host === 'retaha.de';
    context.cookies.set('retaha_lang', urlLang, {
      path: '/',
      domain: isProd ? '.retaha.de' : undefined,
      maxAge: 60 * 60 * 24 * 365, // 1 Jahr
      sameSite: 'lax',
    });
  }

  // 4. URL-Rewrite: /en/login -> intern /login
  //    Astro routet dann zu src/pages/login.astro, currentLang via locals verfuegbar
  if (urlLang) {
    return context.rewrite(cleanPath + url.search);
  }

  return next();
};
