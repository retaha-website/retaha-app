// Sprint i18n-Expansion Phase 9 — UI-Strings auf 10 Sprachen erweitern
//
// Strategie:
//   - DE-Block in src/lib/i18n.ts ist Source-of-Truth (handgepflegt)
//   - Script generiert src/lib/i18n.extra-langs.ts mit UI_STRINGS_EXTRA für
//     die 6 zusätzlichen Sprachen IT/PT/NL/RU/AR/ZH
//   - Idempotent: liest existing extra-langs, übersetzt nur fehlende Keys
//   - Cost-Report am Ende
//
// Run: node --env-file=.env scripts/translate-ui-strings.mjs
//
// UI-String-Kontext für Translation-Prompt:
//   Diese Strings sind kurze UI-Labels in einer Premium-Hotel-Gast-App.
//   Buttons, Toasts, Section-Headers. Halte sie kurz wie das Original.

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const I18N_FILE = join(ROOT, 'src/lib/i18n.ts');
const EXTRA_FILE = join(ROOT, 'src/lib/i18n.extra-langs.ts');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';
const PRICING = { in: 0.80, out: 4.00 };

const EXTRA_LANGS = ['it', 'pt', 'nl', 'ru', 'ar', 'zh'];
const LANG_LABELS = {
  it: 'Italiano', pt: 'Português', nl: 'Nederlands',
  ru: 'Русский', ar: 'العربية', zh: '中文 (vereinfacht)',
};

// ── Parse DE-Block aus i18n.ts ────────────────────────────────────
function parseDeStrings() {
  const src = readFileSync(I18N_FILE, 'utf8');
  // Match `de: { ... },` Block. Greedy bis zur nächsten Top-Level-Sprache.
  const match = src.match(/^\s*de:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:/m);
  if (!match) throw new Error('Could not find DE-block in i18n.ts');
  const body = match[1];
  const entries = {};
  // Match 'key': 'value' (or "key"), simple/escape-aware
  const lineRe = /'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = lineRe.exec(body)) !== null) {
    const key = m[1];
    const value = m[2].replace(/\\'/g, "'").replace(/\\n/g, '\n');
    entries[key] = value;
  }
  return entries;
}

// ── Load existing extra-langs falls vorhanden ─────────────────────
function loadExisting() {
  if (!existsSync(EXTRA_FILE)) return {};
  // Sehr simpel: regex-extract per Sprach-Block via JSON.parse-Trick.
  // Wir generieren das File selbst — Format ist immer derselbe.
  const src = readFileSync(EXTRA_FILE, 'utf8');
  const match = src.match(/export const UI_STRINGS_EXTRA[^=]*=\s*(\{[\s\S]*?\})\s*as const;\s*$/m);
  if (!match) return {};
  try {
    // eval-light via Function — sicher weil wir den File selbst generieren
    return Function('return ' + match[1])();
  } catch { return {}; }
}

// ── Translate ein Key ─────────────────────────────────────────────
function buildPrompt(targetLangLabel) {
  return `Übersetze den folgenden UI-Text aus Deutsch ins ${targetLangLabel}.

Kontext: kurzer UI-Label in einer Premium-Hotel-Gast-App. Button, Toast, Section-Header, Tile-Caption oder Chip-Text.

Regeln:
- Sehr kurz halten (UI-Constraint). NIE länger als das Original — eher kürzer.
- Premium-Hospitality-Ton: warm, elegant.
- Platzhalter wie {name}, {n} EXAKT übernehmen.
- Hotel-Eigennamen ("Gate-Guest", "Wintergarten", "Charlottenburg") NICHT übersetzen.
- Bei Sprachen mit Höflichkeitsdistinktion: formal (Sie/vous/Lei/usted/u/você/Вы).
- AR: rechts-zu-links automatisch. ZH: vereinfacht (Mainland).

Antworte NUR mit der Übersetzung. Kein Kommentar, keine Anführungszeichen.`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function translateOne(text, targetLang, retry = 0) {
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 128,
      system: buildPrompt(LANG_LABELS[targetLang]),
      messages: [{ role: 'user', content: text }],
    });
    const out = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      .replace(/^["„'`]|["""'`]$/g, '').trim();
    return {
      text: out,
      cost: (res.usage.input_tokens / 1e6) * PRICING.in + (res.usage.output_tokens / 1e6) * PRICING.out,
      inTok: res.usage.input_tokens,
      outTok: res.usage.output_tokens,
    };
  } catch (err) {
    // Rate-limit auto-retry (429) — exponential backoff bis zu 4 Versuchen
    if (err?.status === 429 && retry < 4) {
      const wait = Math.min(60000, 5000 * Math.pow(2, retry));
      await sleep(wait);
      return translateOne(text, targetLang, retry + 1);
    }
    throw err;
  }
}

// ── Main ──────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n Phase 9 — UI-Strings auf 10 Sprachen');
console.log('═══════════════════════════════════════════════════════════');

const de = parseDeStrings();
const keys = Object.keys(de);
console.log(`DE-Keys gefunden: ${keys.length}`);

const existing = loadExisting();
console.log(`Existing extra-langs: ${Object.keys(existing).length > 0 ? Object.keys(existing).join(',') : '(none)'}`);

let totalCost = 0, totalIn = 0, totalOut = 0, translated = 0, skipped = 0, fails = 0;

const result = {};
for (const lang of EXTRA_LANGS) {
  result[lang] = { ...(existing[lang] ?? {}) };
  const missing = keys.filter(k => !result[lang][k]);
  console.log(`\n─── ${lang.toUpperCase()} ${LANG_LABELS[lang]} — ${missing.length} keys zu übersetzen (${keys.length - missing.length} schon da)`);
  if (missing.length === 0) { skipped += keys.length; continue; }

  // Parallel pro Sprache (max 5 gleichzeitig, throttle zwischen Batches)
  // Anthropic Tier 1: 50 RPM für Haiku → 5er-Batches mit 8s Pause = 50/min
  const BATCH = 5;
  const BATCH_DELAY_MS = 8000;
  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const slice = missing.slice(i, i + BATCH);
    const batch = await Promise.all(
      slice.map(async key => {
        try {
          const r = await translateOne(de[key], lang);
          return { key, ok: true, ...r };
        } catch (err) {
          return { key, ok: false, error: err.message };
        }
      })
    );
    for (const r of batch) {
      if (r.ok) {
        result[lang][r.key] = r.text;
        totalCost += r.cost; totalIn += r.inTok; totalOut += r.outTok;
        translated++;
      } else {
        console.error(`  ✗ ${r.key}: ${r.error}`);
        fails++;
      }
    }
    process.stdout.write(`  · batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(missing.length / BATCH)} done\n`);
  }
}

// ── Write i18n.extra-langs.ts ────────────────────────────────────
function quote(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"; }
const blocks = EXTRA_LANGS.map(lang => {
  const entries = Object.entries(result[lang]).map(([k, v]) => `    ${quote(k)}: ${quote(v)}`).join(',\n');
  return `  ${lang}: {\n${entries}\n  }`;
}).join(',\n');

const out = `// Sprint i18n-Expansion Phase 9 — Auto-generated UI-Strings für IT/PT/NL/RU/AR/ZH.
// Source-of-Truth: DE-Block in src/lib/i18n.ts. EN/FR/ES sind ebenfalls dort handgepflegt.
// Re-generate via: node --env-file=.env scripts/translate-ui-strings.mjs

export const UI_STRINGS_EXTRA = {
${blocks}
} as const;
`;

writeFileSync(EXTRA_FILE, out);
console.log(`\n✓ Geschrieben: ${EXTRA_FILE}`);

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Translated: ${translated} · Skipped (already present): ${skipped} · Failures: ${fails}`);
console.log(`Tokens: ${totalIn} in + ${totalOut} out`);
console.log(`Cost: $${totalCost.toFixed(5)}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fails > 0 ? 1 : 0);
