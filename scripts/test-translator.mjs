// Sprint i18n-Expansion Phase 2 — Translator Smoke-Test (real Anthropic-Call)
//
// Run: node --env-file=.env scripts/test-translator.mjs
//
// Verifiziert die Translation-Pipeline mit echten Anthropic-Haiku-Calls.
// Standalone: nutzt direkt das SDK statt translator.ts-Imports, weil
// Node-ESM-Resolution `import.meta.env` nicht kennt (Astro/Vite-Magic).
// Die Prompt-Logik ist identisch zu src/lib/i18n/translator.ts.
//
// Sanity-Checks (visuell prüfbar):
//   - EN: knapp, idiomatisch
//   - AR: arabische Zeichen, rechts-zu-links
//   - ZH: vereinfachte Mainland-Zeichen
//   - Premium-Ton bleibt (formelle Anrede)

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('Missing ANTHROPIC_API_KEY in .env'); process.exit(1); }

const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';

const HAIKU_PRICING = { inputPer1M: 0.80, outputPer1M: 4.00 };

const LANGUAGE_LABELS = {
  de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español', it: 'Italiano',
  pt: 'Português', nl: 'Nederlands', ru: 'Русский', ar: 'العربية', zh: '中文',
};
const TARGETS = ['en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'];

function buildSystemPrompt(sourceLang, targetLang) {
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

async function translateOne(text, sourceLang, targetLang) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: Math.max(256, Math.ceil(text.length * 1.5)),
    system: buildSystemPrompt(sourceLang, targetLang),
    messages: [{ role: 'user', content: text }],
  });
  const textBlocks = res.content.filter(b => b.type === 'text');
  const out = textBlocks.map(b => b.text).join('\n').trim().replace(/^["„'`]|["""'`]$/g, '').trim();
  return {
    text: out,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUSD:
      (res.usage.input_tokens / 1_000_000) * HAIKU_PRICING.inputPer1M +
      (res.usage.output_tokens / 1_000_000) * HAIKU_PRICING.outputPer1M,
  };
}

async function translateAll(text, sourceLang) {
  const results = await Promise.all(
    TARGETS.map(async (lang) => {
      try {
        const r = await translateOne(text, sourceLang, lang);
        return { lang, ok: true, ...r };
      } catch (err) {
        return { lang, ok: false, error: err.message ?? String(err) };
      }
    })
  );
  return results;
}

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('Sprint i18n-Expansion Phase 2 — Translator Real-Run');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(`Model: ${MODEL}`);
console.log(`Source: 3 echte Hotel-Texte aus Gate Garden Demo-Hotel`);
console.log(`Targets: ${TARGETS.join(', ')} (9 Sprachen, parallel)\n`);

const TESTS = [
  { label: 'Eyebrow (kurz)', text: 'Morgen Mittag' },
  { label: 'Title (knapp)', text: 'Tisch draußen' },
  { label: 'Subtitle (Satz)', text: 'Reservier dir den Birnbaum-Tisch für morgen — bei dem Wetter perfekt.' },
];

let totalCost = 0;
let totalIn = 0, totalOut = 0, totalFailed = 0;

for (const t of TESTS) {
  console.log(`─── ${t.label} ────────────────────────────────────────────────────────`);
  console.log(`DE: ${t.text}\n`);

  const start = performance.now();
  const results = await translateAll(t.text, 'de');
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);

  for (const r of results) {
    if (r.ok) {
      console.log(`  ${r.lang.toUpperCase()} · ${LANGUAGE_LABELS[r.lang].padEnd(11)} ${r.text}`);
      totalCost += r.costUSD;
      totalIn += r.inputTokens;
      totalOut += r.outputTokens;
    } else {
      console.log(`  ${r.lang.toUpperCase()} · ⚠ FAILED — ${r.error}`);
      totalFailed++;
    }
  }
  const batchCost = results.filter(r => r.ok).reduce((s, r) => s + r.costUSD, 0);
  const batchIn = results.filter(r => r.ok).reduce((s, r) => s + r.inputTokens, 0);
  const batchOut = results.filter(r => r.ok).reduce((s, r) => s + r.outputTokens, 0);
  console.log(`\n  → ${batchIn} in + ${batchOut} out tokens · $${batchCost.toFixed(5)} · ${elapsed}s wall-clock (parallel)\n`);
}

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(`TOTAL: ${totalIn} in + ${totalOut} out tokens · ${totalFailed} failures`);
console.log(`COST:  $${totalCost.toFixed(5)} — für 3 Cards × 9 Sprachen = 27 Übersetzungen`);
console.log(`AVG:   $${(totalCost / 27).toFixed(6)} pro Single-Field-Translation`);
console.log('═══════════════════════════════════════════════════════════════════════════');
