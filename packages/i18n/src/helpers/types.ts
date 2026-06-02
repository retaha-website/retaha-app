// Sprint i18n-Expansion Phase 1 — Type-System
//
// Erweitert das alte src/lib/i18n.ts Lang-Tupel (4 Sprachen) auf 10 Sprachen.
// Alte i18n.ts bleibt unverändert bis Phase 9 (UI-Strings-Migration).
//
// JSONB-Pattern für i18n-Felder (Briefing #2): I18nValue mit source-marker.
//   - source='original': vom Hotelier in seiner Default-Sprache eingegeben
//   - source='auto':     von Haiku übersetzt
//   - source='override': zukünftige Manual-Override-UI (Backlog)
//
// AR und ZH sind RTL/CJK — keine Sonderbehandlung in dieser Phase, aber
// Phase 5 (Editor-UI) und Phase 7 (Gast-Frontend) brauchen dir="rtl" für AR.

export const LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'] as const;
export type LanguageCode = typeof LANGUAGES[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  ru: 'Русский',
  ar: 'العربية',
  zh: '中文',
};

/** ISO 639-1 fallback default. Wenn weder User-Sprache noch Hotel-Default verfügbar. */
export const DEFAULT_LANGUAGE: LanguageCode = 'de';

/** Sprachen mit Right-to-Left Schriftrichtung — Phase 5/7 brauchen dir="rtl". */
export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set(['ar']);

export function isRTL(lang: LanguageCode): boolean {
  return RTL_LANGUAGES.has(lang);
}

/** Type-Guard für Runtime-Input (URL-Params, Browser-Locale, DB-Strings). */
export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Normalisiert beliebigen Input zu einem gültigen LanguageCode.
 * - Strip auf 2-Letter (z.B. 'de-DE' → 'de', 'zh-CN' → 'zh')
 * - lowercase
 * - Fallback auf DEFAULT_LANGUAGE wenn ungültig
 */
export function normalizeLanguage(input: string | null | undefined): LanguageCode {
  if (!input) return DEFAULT_LANGUAGE;
  const stripped = input.toLowerCase().slice(0, 2);
  return isLanguageCode(stripped) ? stripped : DEFAULT_LANGUAGE;
}

/**
 * JSONB-Pattern in DB-Spalten wie title_i18n, hotel_note_i18n, etc.
 * Eine Sprache kann fehlen (undefined) — der pickI18n-Helper fängt das ab.
 */
export type I18nValue = Partial<Record<LanguageCode, {
  value: string;
  source: 'original' | 'auto' | 'override';
  updated_at?: string;
}>>;

/**
 * Vereinfachte String-Map ohne source-marker. Für UI-Strings (Phase 9)
 * und Stellen wo source nicht relevant ist.
 */
export type I18nStrings = Partial<Record<LanguageCode, string>>;

/** Helper für Builder-Pattern beim Schreiben (z.B. in Translation-Hook). */
export function makeI18nEntry(
  value: string,
  source: 'original' | 'auto' | 'override' = 'original',
): { value: string; source: 'original' | 'auto' | 'override'; updated_at: string } {
  return { value, source, updated_at: new Date().toISOString() };
}
