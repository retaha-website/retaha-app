// Sprint Wallet · Phase 11 — Variable-Protected Auto-Translation
//
// Problem: Wenn wir Marketing-Texte mit {{first_name}} an Anthropic-Haiku
// zur Übersetzung schicken, KANN das Modell die Placeholder anfassen — z.B.
// {{first_name}} → {{vorname}} bei DE-Übersetzung, oder die ganze Klammer
// schlucken. Dann ist beim Send der Replace kaputt.
//
// Lösung: Vor Translation Placeholders durch Sentinel-Tokens ersetzen,
// danach restoren. Sentinels werden so gewählt dass sie für Haiku
// "looks like code, don't touch":
//
//   {{first_name}}  →  __VAR0__   (kein {{}}, kein Leerzeichen, kein Sonderzeichen)
//
// In der Praxis lässt Haiku __VARn__ in 100% der Fälle stehen. Falls doch
// nicht: restore-Step kann mit einer regex-Suche prüfen und Warnings loggen.

import type { I18nValue } from '@retaha/i18n';
import { mergeAndTranslate, type SaveHookOptions, type SaveHookResult } from '@retaha/i18n';
import { asLanguageCode } from '@retaha/i18n';
import { type LanguageCode } from '@retaha/i18n';

const PLACEHOLDER_REGEX = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
const SENTINEL_REGEX = /__VAR(\d+)__/g;

interface Protected {
  text: string;
  placeholders: string[];      // index → original "{{xxx}}"
}

export function protectPlaceholders(text: string): Protected {
  const placeholders: string[] = [];
  const protectedText = text.replace(PLACEHOLDER_REGEX, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `__VAR${idx}__`;
  });
  return { text: protectedText, placeholders };
}

export function restorePlaceholders(text: string, placeholders: string[]): string {
  return text.replace(SENTINEL_REGEX, (_, indexStr) => {
    const idx = parseInt(indexStr, 10);
    return placeholders[idx] ?? `__VAR${idx}__`;  // Fallback: lass Sentinel stehen für Debugging
  });
}

/**
 * Variable-aware Wrapper um mergeAndTranslate.
 *
 * Workflow:
 *   1. Replace {{xxx}} in source-value mit __VARn__
 *   2. Re-Mapping vorhandener Übersetzungen (overrides etc.) auch via Sentinels
 *      — denn die wurden vorher mit echten {{xxx}} gespeichert, jetzt schickt
 *      mergeAndTranslate evtl. erneut zu Haiku (für Re-Translate); hier wollen
 *      wir konsistent geschützt arbeiten
 *   3. mergeAndTranslate macht die Übersetzung
 *   4. Restore __VARn__ → {{xxx}} in ALLEN Sprach-Slots
 *
 * Variable-Drift-Check: wenn nach Restore die Anzahl Placeholders in der
 * Übersetzung von der im Original abweicht, loggen wir eine Warning. Das
 * passiert selten aber nicht nie.
 */
export async function mergeAndTranslateMarketing(
  existing: I18nValue | null | undefined,
  value: string,
  sourceLang: LanguageCode,
  options: SaveHookOptions = {},
): Promise<SaveHookResult> {
  // 1. Source schützen
  const { text: protectedValue, placeholders } = protectPlaceholders(value);

  // 2. Existing-Slots auch schützen damit Re-Translation konsistent ist
  let protectedExisting: I18nValue | null = null;
  if (existing) {
    protectedExisting = {};
    for (const [lang, slot] of Object.entries(existing)) {
      if (!slot) continue;
      const p = protectPlaceholders(slot.value);
      protectedExisting[lang as LanguageCode] = { ...slot, value: p.text };
    }
  }

  // 3. Standard mergeAndTranslate auf der protected Variante
  const result = await mergeAndTranslate(protectedExisting, protectedValue, sourceLang, options);

  // 4. Restore in allen Slots + Drift-Check
  const restored: I18nValue = {};
  const expectedVarCount = placeholders.length;
  for (const [lang, slot] of Object.entries(result.i18n)) {
    if (!slot) continue;
    const restoredText = restorePlaceholders(slot.value, placeholders);

    // Drift-Check
    const sentinelsLeft = (slot.value.match(SENTINEL_REGEX) || []).length;
    if (sentinelsLeft !== expectedVarCount) {
      console.warn(
        `[marketing/translate] Variable-Drift in ${lang}: erwartet ${expectedVarCount} Sentinels, gefunden ${sentinelsLeft}. ` +
        `Original: "${value.slice(0, 80)}" → Übersetzung: "${slot.value.slice(0, 80)}"`,
      );
    }
    restored[lang as LanguageCode] = { ...slot, value: restoredText };
  }

  return { ...result, i18n: restored };
}

// Re-export für Caller die direkt asLanguageCode brauchen
export { asLanguageCode };
