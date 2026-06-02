/**
 * Lokale Lang-Type-Definition für @retaha/eve.
 *
 * Identisch zu @retaha/i18n LanguageCode, aber LOKAL definiert um Workspace-
 * Cycle eve→i18n→eve zu vermeiden.
 *
 * Source-of-Truth bleibt @retaha/i18n. Wenn neue Sprachen hinzukommen, müssen
 * BEIDE Stellen synchronisiert werden (siehe packages/i18n/src/helpers/types.ts).
 *
 * Warum lokal statt cross-package?
 *   - @retaha/i18n's translator.ts importiert eveComplete/EVE_MODEL_HAIKU von eve
 *   - Wenn eve dann von i18n importiert, gibt's einen Workspace-Cycle
 *   - Lang ist nur ein String-Union → trivial zu duplizieren, kein Risiko
 */

export const EVE_LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'] as const;
export type Lang = typeof EVE_LANGUAGES[number];
