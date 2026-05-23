import type { AdminLocale } from './types';
import { SUPPORTED_ADMIN_LOCALES, DEFAULT_ADMIN_LOCALE } from './constants';

/**
 * Parst den Accept-Language Header und gibt die erste unterstützte Locale zurück.
 * Format-Beispiel: "en-US,en;q=0.9,de;q=0.8" → ["en", "de"]
 */
export function parseAcceptLanguage(header: string | null): AdminLocale | null {
  if (!header) return null;

  const candidates = header
    .split(',')
    .map(part => part.split(';')[0]?.trim().slice(0, 2).toLowerCase())
    .filter((code): code is string => Boolean(code));

  for (const code of candidates) {
    if (SUPPORTED_ADMIN_LOCALES.includes(code as AdminLocale)) {
      return code as AdminLocale;
    }
  }

  return null;
}

/**
 * Resolution-Reihenfolge für Backoffice-Locale:
 *   1. URL `?locale=xx` (Dev-Override, nicht persistent)
 *   2. User-Metadata `locale` (authenticated User)
 *   3. `onboarding_locale` Cookie (Pre-Auth-Persist während Onboarding)
 *   4. Accept-Language-Header
 *   5. Default (DE)
 */
export function resolveAdminLocale(params: {
  url: URL;
  userMetadataLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AdminLocale {
  const urlOverride = params.url.searchParams.get('locale');
  if (urlOverride && SUPPORTED_ADMIN_LOCALES.includes(urlOverride as AdminLocale)) {
    return urlOverride as AdminLocale;
  }

  if (params.userMetadataLocale && SUPPORTED_ADMIN_LOCALES.includes(params.userMetadataLocale as AdminLocale)) {
    return params.userMetadataLocale as AdminLocale;
  }

  if (params.cookieLocale && SUPPORTED_ADMIN_LOCALES.includes(params.cookieLocale as AdminLocale)) {
    return params.cookieLocale as AdminLocale;
  }

  const fromHeader = parseAcceptLanguage(params.acceptLanguage ?? null);
  if (fromHeader) return fromHeader;

  return DEFAULT_ADMIN_LOCALE;
}
