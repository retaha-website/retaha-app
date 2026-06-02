// Sprint i18n-Expansion Phase 2 — Translation-Pipeline mit Anthropic Haiku
//
// Wiederverwendet eveComplete aus src/lib/eve/anthropic-client.ts (Briefing
// Hinweis 1). Eve nutzt Hybrid Haiku/Sonnet für Conversation-Quality —
// Translation nutzt IMMER Haiku (schnell, günstig, ausreichend für Text-
// Übersetzung; Sonnet wäre Verschwendung).
//
// Async-Pattern für Phase 6 Save-Hook:
//   Die Funktionen returnen Promises synchron. Der "fire-and-forget" passiert
//   im Caller (Phase 6 Hook ruft .then().catch() ohne await).
//
// Parallelisierung (Hinweis 3): 9 Sprachen parallel via Promise.allSettled.
// Ein Fail killt nicht die anderen 8. Failures werden geloggt + zurückgegeben.
//
// Cost-Tracking (Hinweis 4) ab Anfang: pro Translation-Batch console.info.
// Haiku-Pricing 2026-05: $0.80/1M input, $4.00/1M output.

import {
  LANGUAGE_LABELS,
  LANGUAGES,
  type LanguageCode,
  type I18nValue,
  makeI18nEntry,
} from './types.ts';
import { eveComplete, EVE_MODEL_HAIKU } from '@retaha/eve';

// ── Pricing (Stand 2026-05 — anpassen falls Anthropic Preise ändert) ────
const HAIKU_PRICING = {
  inputPer1M: 0.80,   // USD per 1M input tokens
  outputPer1M: 4.00,  // USD per 1M output tokens
} as const;

export type TranslationCost = {
  inputTokens: number;
  outputTokens: number;
  estimatedUSD: number;
  /** Sprachen die tatsächlich Tokens verbraucht haben (sourceLang excluded). */
  languages: LanguageCode[];
};

export type TranslationFailure = {
  lang: LanguageCode;
  error: string;
};

function buildSystemPrompt(sourceLang: LanguageCode, targetLang: LanguageCode): string {
  return `
Du bist ein professioneller Übersetzer für eine Premium-Hotel-App.

Übersetze den folgenden Text aus ${LANGUAGE_LABELS[sourceLang]} (${sourceLang}) ins ${LANGUAGE_LABELS[targetLang]} (${targetLang}).

Regeln:
- Behalte den Premium-Hospitality-Ton: warm, elegant, professionell.
- Halte die Länge ähnlich zum Original — kürzer ist besser (UI-Constraint).
  Beispiel: "Tisch draußen reservieren" → "Reserve outdoor table"
  (NICHT "Reserve a table in the outdoor area").
- Hotel-Fachbegriffe: nutze Standard-Branche-Vokabular der Zielsprache.
- Eigennamen (Restaurants, Plätze, Hotels, Salon-Namen): NICHT übersetzen.
- Zeitangaben, Preise, Zahlen: NICHT übersetzen.
- Bei Sprachen mit Höflichkeitsdistinktion (de/fr/it/es/nl/pt/ru):
  formelle Anrede verwenden ("Sie", "vous", "Lei", "usted", "u", "você", "Вы").
- Bei AR: rechts-zu-links ist automatisch (kein extra Marker).
- Bei ZH: vereinfachte Schriftzeichen (Mainland-Standard).

Antworte NUR mit der reinen Übersetzung. Kein Kommentar, keine Erklärung, kein Markdown-Wrapper, keine Anführungszeichen am Anfang/Ende.
`.trim();
}

/**
 * Einzelne Übersetzung. Wirft bei API-Errors (Retry-Logic ist im eveComplete-
 * Wrapper). Bei leerem oder identischem source-Text: no-op, kostet 0 Tokens.
 */
export async function translateText(
  text: string,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
): Promise<{ text: string; cost: TranslationCost }> {
  if (sourceLang === targetLang || !text.trim()) {
    return {
      text: text,
      cost: { inputTokens: 0, outputTokens: 0, estimatedUSD: 0, languages: [] },
    };
  }

  const result = await eveComplete({
    model: EVE_MODEL_HAIKU,
    systemPrompt: buildSystemPrompt(sourceLang, targetLang),
    messages: [{ role: 'user', content: text }],
    enableCaching: false,  // Translation-Prompts sind kurz, Cache hilft nicht (Min ~1024 Tokens)
    maxTokens: Math.max(256, Math.ceil(text.length * 1.5)),  // großzügig für CJK-Expansion
  });

  const out = result.content.trim().replace(/^["„'`]|["""'`]$/g, '').trim();

  const cost: TranslationCost = {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    estimatedUSD:
      (result.usage.inputTokens / 1_000_000) * HAIKU_PRICING.inputPer1M +
      (result.usage.outputTokens / 1_000_000) * HAIKU_PRICING.outputPer1M,
    languages: [targetLang],
  };

  return { text: out, cost };
}

/**
 * Übersetzt parallel in alle 9 Zielsprachen (oder eine explizite Auswahl).
 * Returns ein vollständiges I18nValue + Cost-Summe + Failure-Liste.
 *
 * NIEMALS reject — auch wenn alle 9 fehlschlagen kommt ein valides Objekt
 * zurück (mit dem source-Eintrag + failures).
 */
export async function translateToAllLanguages(
  text: string,
  sourceLang: LanguageCode,
  targetLangs?: LanguageCode[],
): Promise<{
  value: I18nValue;
  cost: TranslationCost;
  failures: TranslationFailure[];
}> {
  const targets = (targetLangs ?? LANGUAGES.filter(l => l !== sourceLang));

  // Source-Eintrag immer setzen (auch wenn text leer ist)
  const value: I18nValue = {
    [sourceLang]: makeI18nEntry(text, 'original'),
  };

  if (!text.trim()) {
    return {
      value,
      cost: { inputTokens: 0, outputTokens: 0, estimatedUSD: 0, languages: [] },
      failures: [],
    };
  }

  // Parallel mit Catch-Wrapper damit der Lang-Code bei Failure erhalten bleibt
  const results = await Promise.all(
    targets.map(async (lang) => {
      try {
        const { text: translated, cost } = await translateText(text, sourceLang, lang);
        return { lang, ok: true as const, text: translated, cost };
      } catch (err) {
        return { lang, ok: false as const, error: (err as Error).message ?? String(err) };
      }
    })
  );

  const totalCost: TranslationCost = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedUSD: 0,
    languages: [],
  };
  const failures: TranslationFailure[] = [];

  for (const r of results) {
    if (r.ok) {
      value[r.lang] = makeI18nEntry(r.text, 'auto');
      totalCost.inputTokens += r.cost.inputTokens;
      totalCost.outputTokens += r.cost.outputTokens;
      totalCost.estimatedUSD += r.cost.estimatedUSD;
      totalCost.languages.push(r.lang);
    } else {
      failures.push({ lang: r.lang, error: r.error });
      console.warn(`[i18n/translator] ${sourceLang}→${r.lang} failed: ${r.error}`);
    }
  }

  // Cost-Log pro Batch (Hinweis 4)
  console.info(
    `[i18n/translator] "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}" ` +
    `${sourceLang}→[${totalCost.languages.join(',')}] · ` +
    `${totalCost.inputTokens} in + ${totalCost.outputTokens} out tokens · ` +
    `$${totalCost.estimatedUSD.toFixed(5)}` +
    (failures.length ? ` · ${failures.length} failed: [${failures.map(f => f.lang).join(',')}]` : '')
  );

  return { value, cost: totalCost, failures };
}

/**
 * Helper: nur die fehlenden Sprachen übersetzen. Nützlich für Re-Translation
 * nach Failures oder beim Hinzufügen neuer Sprachen zu enabled_languages.
 */
export async function translateMissing(
  existing: I18nValue,
  sourceLang: LanguageCode,
  allLangs: LanguageCode[] = [...LANGUAGES],
): Promise<{
  value: I18nValue;
  cost: TranslationCost;
  failures: TranslationFailure[];
}> {
  const sourceText = existing[sourceLang]?.value;
  if (!sourceText) {
    throw new Error(`translateMissing: source language ${sourceLang} has no value in existing I18nValue`);
  }
  const missing = allLangs.filter(l => l !== sourceLang && !existing[l]?.value);
  const result = await translateToAllLanguages(sourceText, sourceLang, missing);
  // Bestehende Werte merge'n (source + existierende Übersetzungen)
  return {
    value: { ...existing, ...result.value },
    cost: result.cost,
    failures: result.failures,
  };
}
