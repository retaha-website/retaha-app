// Sprint i18n-Expansion Phase 6 — Translation-Save-Hook
//
// Zentrale Funktion die der Save-Pfad ALLER 8 Pages (Phase 5) aufruft.
// Pattern: schreibe Original sofort, übersetze sync in parallel die fehlenden
// Sprachen (override bleibt unangetastet, source='auto' wird re-übersetzt
// wenn das Original gewechselt hat).
//
// Architektur-Entscheidung "synchron statt fire-and-forget":
//   Astro/Vercel-Edge-Functions können keine Promises nach response.return
//   weiterlaufen lassen — würde gecancelt. Echtes Background-Job-Pattern
//   (Edge Function, Job-Queue) ist Backlog. Phase 6 nutzt parallel-Sync:
//   9 Anthropic-Calls in ~3-7s wall-clock (Haiku ist schnell + parallel).
//   Hotelier-UX: Save-Button wartet 3-7s, danach sind alle Sprachen da.
//
// Override-Marker-Behandlung:
//   - source='override': NIE überschreiben (Hotelier hat manuell gepflegt)
//   - source='auto': re-übersetzen wenn Original geändert
//   - source='original': der Default-Sprach-Eintrag, wird vom Caller gesetzt
//   - fehlend: übersetzen

import {
  LANGUAGES,
  type LanguageCode,
  type I18nValue,
  isLanguageCode,
} from './types.ts';
import { translateText, type TranslationCost } from './translator.ts';

const NOW = () => new Date().toISOString();

export type SaveHookResult = {
  i18n: I18nValue;
  cost: TranslationCost;
  failures: Array<{ lang: LanguageCode; error: string }>;
  durationMs: number;
};

export type SaveHookOptions = {
  /** Vollständige Übersetzung in alle LANGUAGES, oder nur in enabledLangs?
   *  Default: alle 10 (Briefing-Entscheidung #4: "Eve nutzt alle 10 Sprachen
   *  unabhängig von UI-Limit", also haben wir Auto-Translations für alle bereit
   *  falls ein Hotel später eine neue Sprache enabled). */
  translateAll?: boolean;
  /** Label für console.info-Logs (z.B. "action_cards.title:abc-123"). */
  logLabel?: string;
};

/**
 * Merge eines i18n-Feldes mit Auto-Translation.
 *
 * Workflow:
 *   1. Wenn value leer → entferne sourceLang-Slot, return existing (no-op)
 *   2. Schreibe value in i18n[sourceLang] mit source='original'
 *   3. Identifiziere targets: alle Sprachen ≠ sourceLang, die nicht 'override' sind
 *      ODER deren 'auto'-Value veraltet ist (anderer Original-Text)
 *   4. Parallel translate via translateText (aus Phase 2)
 *   5. Schreibe Übersetzungen in i18n[targetLang] mit source='auto'
 *   6. Log Cost + Failures
 *   7. Return merged I18nValue
 */
export async function mergeAndTranslate(
  existing: I18nValue | null | undefined,
  value: string,
  sourceLang: LanguageCode,
  options: SaveHookOptions = {},
): Promise<SaveHookResult> {
  const start = Date.now();
  const trimmed = (value ?? '').trim();
  const merged: I18nValue = { ...(existing ?? {}) };
  const totalCost: TranslationCost = {
    inputTokens: 0, outputTokens: 0, estimatedUSD: 0, languages: [],
  };
  const failures: Array<{ lang: LanguageCode; error: string }> = [];

  // 1. Leerer Wert → sourceLang löschen, keine Translation
  if (!trimmed) {
    delete merged[sourceLang];
    return {
      i18n: Object.keys(merged).length > 0 ? merged : ({} as I18nValue),
      cost: totalCost, failures, durationMs: Date.now() - start,
    };
  }

  // 2. Original-Eintrag setzen
  merged[sourceLang] = { value: trimmed, source: 'original', updated_at: NOW() };

  // 3. Targets identifizieren
  const targets: LanguageCode[] = LANGUAGES.filter(lang => {
    if (lang === sourceLang) return false;
    const slot = merged[lang];
    // Override-Werte bleiben unangetastet
    if (slot?.source === 'override') return false;
    // Wenn 'auto' existiert: re-translaten wenn Original geändert
    // (kein Way zu prüfen vs. Original — also immer re-translaten, sicherer)
    return true;
  });

  if (targets.length === 0) {
    return { i18n: merged, cost: totalCost, failures, durationMs: Date.now() - start };
  }

  // 4. Parallel translate (per-call catch damit eine Failure die anderen nicht killt)
  const results = await Promise.all(
    targets.map(async (lang) => {
      try {
        const { text, cost } = await translateText(trimmed, sourceLang, lang);
        return { lang, ok: true as const, text, cost };
      } catch (err) {
        return { lang, ok: false as const, error: (err as Error).message ?? String(err) };
      }
    })
  );

  // 5. Übersetzungen integrieren
  for (const r of results) {
    if (r.ok) {
      merged[r.lang] = { value: r.text, source: 'auto', updated_at: NOW() };
      totalCost.inputTokens += r.cost.inputTokens;
      totalCost.outputTokens += r.cost.outputTokens;
      totalCost.estimatedUSD += r.cost.estimatedUSD;
      totalCost.languages.push(r.lang);
    } else {
      failures.push({ lang: r.lang, error: r.error });
    }
  }

  // 6. Log
  const label = options.logLabel || 'i18n-save-hook';
  const durationMs = Date.now() - start;
  console.info(
    `[${label}] "${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}" ` +
    `${sourceLang}→[${totalCost.languages.join(',')}] · ` +
    `${totalCost.inputTokens}+${totalCost.outputTokens} tok · ` +
    `$${totalCost.estimatedUSD.toFixed(5)} · ${durationMs}ms` +
    (failures.length ? ` · ${failures.length} failed: [${failures.map(f => f.lang).join(',')}]` : '')
  );

  return { i18n: merged, cost: totalCost, failures, durationMs };
}

/**
 * Helper: typesafe sourceLang aus String (z.B. hotel.default_language) — fällt
 * auf 'de' zurück wenn unbekannt. Der Save-Hook akzeptiert nur valide
 * LanguageCodes; dies ist die Brücke zur Welt der DB-Strings.
 */
export function asLanguageCode(input: string | null | undefined): LanguageCode {
  return isLanguageCode(input) ? input : 'de';
}
