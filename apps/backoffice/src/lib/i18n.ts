// Backoffice-Sprach-Auflösung. Persistenz = Cookie `retaha_lang` (gesetzt vom
// Sprach-Picker im Account-Dropdown). Kette: Cookie → Accept-Language → 'de'.
import type { AstroCookies } from 'astro';
import { normalizeLanguage, type LanguageCode } from '@retaha/i18n';

export const LANG_COOKIE = 'retaha_lang';

export function getLang(cookies: AstroCookies, request: Request): LanguageCode {
  // 1) ?lang= in der URL (vom Sprach-Picker gesetzt) hat Vorrang.
  try {
    const urlLang = new URL(request.url).searchParams.get('lang');
    if (urlLang) return normalizeLanguage(urlLang);
  } catch { /* request.url evtl. relativ — ignorieren */ }
  // 2) Cookie → 3) Accept-Language → 4) 'de'.
  const cookieLang = cookies.get(LANG_COOKIE)?.value;
  if (cookieLang) return normalizeLanguage(cookieLang);
  const accept = request.headers.get('accept-language') ?? '';
  const first = accept.split(',')[0]?.trim();
  return normalizeLanguage(first);
}

export { bt } from '@retaha/i18n';
export type { LanguageCode };
