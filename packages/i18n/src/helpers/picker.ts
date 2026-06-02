// Sprint i18n-Expansion Phase 1 — Picker-Helpers
//
// Sprach-Fallback-Hierarchie (Briefing #5):
//   1. User-Sprache (vom Selector / Browser / URL-Param)
//   2. Hotelier-Default-Sprache (hotel_settings.default_language)
//   3. DEFAULT_LANGUAGE = 'de' (Global-Safety)
//   4. Leerstring (statt undefined — UI rendert dann nichts)
//
// Zwei Varianten:
//   - pickI18n: für I18nValue (mit source-marker, aus DB-JSONB)
//   - pickI18nString: für I18nStrings (simple map, für UI-Strings)

import {
  type LanguageCode,
  type I18nValue,
  type I18nStrings,
  LANGUAGES,
  DEFAULT_LANGUAGE,
} from './types.ts';

export function pickI18n(
  value: I18nValue | null | undefined,
  hotelierDefault: LanguageCode,
  userLang: LanguageCode,
): string {
  if (!value) return '';
  return (
    value[userLang]?.value ||
    value[hotelierDefault]?.value ||
    value[DEFAULT_LANGUAGE]?.value ||
    ''
  );
}

export function pickI18nString(
  value: I18nStrings | null | undefined,
  hotelierDefault: LanguageCode,
  userLang: LanguageCode,
): string {
  if (!value) return '';
  return (
    value[userLang] ||
    value[hotelierDefault] ||
    value[DEFAULT_LANGUAGE] ||
    ''
  );
}

/**
 * Welche Sprachen sind im JSONB vorhanden (mit non-empty value)?
 * Nützlich für UI-Indikatoren ("Übersetzungen in 8 Sprachen ✓").
 */
export function availableLanguages(value: I18nValue | null | undefined): LanguageCode[] {
  if (!value) return [];
  return LANGUAGES.filter(lang => !!value[lang]?.value);
}

/**
 * Welche Sprachen fehlen (für Translation-Job-Trigger).
 */
export function missingLanguages(value: I18nValue | null | undefined): LanguageCode[] {
  const present = new Set(availableLanguages(value));
  return LANGUAGES.filter(lang => !present.has(lang));
}

/**
 * Welche Sprachen wurden auto-übersetzt (vs. original / override)?
 * Phase 6 nutzt das für Status-Tracking im Editor.
 */
export function autoTranslatedLanguages(value: I18nValue | null | undefined): LanguageCode[] {
  if (!value) return [];
  return LANGUAGES.filter(lang => value[lang]?.source === 'auto');
}
