// Backoffice-UI-Strings auf alle Sprachen erweitern (Haiku-Auto-Translate).
//
// Source-of-Truth: DE-Block in packages/i18n/src/backoffice-strings.ts (handgepflegt).
// Script übersetzt fehlende Keys in en/fr/es/it/pt/nl/ru/ar/zh/tr und schreibt die
// Datei neu (BO_STRINGS + bt() bleiben erhalten). Idempotent: nur fehlende Keys.
//
// Run:  node --env-file=apps/backoffice/.env scripts/translate-backoffice-strings.mjs
//
// Kontext für den Prompt: kurze Admin-/Backoffice-UI-Labels (Hotelier-Seite).

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FILE = join(ROOT, 'packages/i18n/src/backoffice-strings.ts');
// Snapshot der DE-Werte beim letzten Lauf — um GEÄNDERTE Strings (nicht nur fehlende)
// zu erkennen und neu zu übersetzen. Wird committet (= „zuletzt übersetzter DE-Stand").
const SNAP = join(ROOT, 'packages/i18n/backoffice-strings.snapshot.json');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('Missing ANTHROPIC_API_KEY (use --env-file=apps/backoffice/.env)'); process.exit(1); }
const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';
const PRICING = { in: 0.80, out: 4.00 };

const TARGET_LANGS = ['en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh', 'tr'];
const ALL_LANGS = ['de', ...TARGET_LANGS];
const LANG_LABELS = {
  en: 'English', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português',
  nl: 'Nederlands', ru: 'Русский', ar: 'العربية', zh: '中文 (vereinfacht)', tr: 'Türkçe',
};

// ── Parse BO_STRINGS-Objekt aus der Datei ────────────────────────────
function parseStrings() {
  const src = readFileSync(FILE, 'utf8');
  const m = src.match(/export const BO_STRINGS[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('Could not find BO_STRINGS object in ' + FILE);
  return Function('return ' + m[1])();
}

function buildPrompt(label) {
  return `Übersetze den folgenden UI-Text aus Deutsch ins ${label}.

Kontext: kurzer UI-Label in der ADMIN-/BACKOFFICE-Oberfläche einer Hotel-SaaS (Hotelier-Seite, nicht Gast). Button, Menü-Eintrag, Section-Titel, Feld-Label, Hinweis, Fehlermeldung oder Toast.

Regeln:
- Sehr kurz halten (UI-Constraint). NIE länger als das Original.
- Sachlich-professioneller Software-Ton (kein Marketing-Sprech).
- Platzhalter wie {name}, {n}, {email} EXAKT übernehmen.
- Eigennamen/Marken NICHT übersetzen: retaha, WhatsApp, Apple/Google Wallet, Mews, Stripe, PMS, 2FA, Wi-Fi, NFC, Eve.
- Etablierte Branchen-/Software-Begriffe der Zielsprache nutzen (Check-in, Check-out, Dashboard wo üblich).
- Bei Höflichkeitsdistinktion: formelle/neutrale Software-Anrede.
- AR: rechts-zu-links automatisch. ZH: vereinfacht (Mainland).

Antworte NUR mit der Übersetzung. Kein Kommentar, keine Anführungszeichen.`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function translateOne(text, label, retry = 0) {
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 200, system: buildPrompt(label),
      messages: [{ role: 'user', content: text }],
    });
    const out = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      .replace(/^["„'`]|["""'`]$/g, '').trim();
    return { text: out, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
  } catch (err) {
    if (err?.status === 429 && retry < 4) {
      await sleep(Math.min(60000, 5000 * Math.pow(2, retry)));
      return translateOne(text, label, retry + 1);
    }
    throw err;
  }
}

// ── Main ─────────────────────────────────────────────────────────────
const data = parseStrings();
const de = data.de ?? {};
const keys = Object.keys(de);
const snap = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : {};
const changed = keys.filter(k => snap[k] !== undefined && snap[k] !== de[k]);
console.log(`BO_STRINGS DE-Keys: ${keys.length}${changed.length ? ` (${changed.length} geändert seit letztem Lauf → neu übersetzen)` : ''}`);

let totalIn = 0, totalOut = 0, translated = 0, fails = 0;
const result = { de };

for (const lang of TARGET_LANGS) {
  result[lang] = { ...(data[lang] ?? {}) };
  const missing = keys.filter(k => !result[lang][k] || (snap[k] !== undefined && snap[k] !== de[k]));
  console.log(`\n─── ${lang.toUpperCase()} ${LANG_LABELS[lang]} — ${missing.length} fehlend (${keys.length - missing.length} da)`);
  if (missing.length === 0) continue;
  const BATCH = 5, DELAY = 8000;
  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(DELAY);
    const slice = missing.slice(i, i + BATCH);
    const batch = await Promise.all(slice.map(async key => {
      try { const r = await translateOne(de[key], LANG_LABELS[lang]); return { key, ok: true, ...r }; }
      catch (err) { return { key, ok: false, error: err.message }; }
    }));
    for (const r of batch) {
      if (r.ok) { result[lang][r.key] = r.text; totalIn += r.inTok; totalOut += r.outTok; translated++; }
      else { console.error(`  ✗ ${r.key}: ${r.error}`); fails++; }
    }
    process.stdout.write(`  · batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(missing.length / BATCH)}\n`);
  }
}

// ── Datei neu schreiben ──────────────────────────────────────────────
function quote(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"; }
function langBlock(lang) {
  const obj = result[lang] ?? {};
  const entries = keys.filter(k => obj[k] != null).map(k => `    ${quote(k)}: ${quote(obj[k])}`).join(',\n');
  return `  ${lang}: {\n${entries}\n  }`;
}
const blocks = ALL_LANGS.filter(l => result[l]).map(langBlock).join(',\n');

const out = `// Backoffice-UI-Strings (Hotelier-Seite) — DE = Source-of-Truth (handgepflegt).
// Übrige Sprachen via scripts/translate-backoffice-strings.mjs (Haiku). Fehlende
// Keys fallen via bt() sauber auf DE zurück.
//
// Aufruf:  bt('dd.profile', lang)
import { type LanguageCode } from './helpers/types';

export const BO_STRINGS: Partial<Record<LanguageCode, Record<string, string>>> = {
${blocks}
};

/**
 * Backoffice-Translate. Fallback-Kette: gewählte Sprache → DE → Key selbst
 * (damit nie ein leerer String oder ein Key-Leak entsteht).
 */
export function bt(key: string, lang: LanguageCode): string {
  return BO_STRINGS[lang]?.[key] ?? BO_STRINGS.de?.[key] ?? key;
}
`;

writeFileSync(FILE, out);
writeFileSync(SNAP, JSON.stringify(de, null, 0) + '\n');
console.log(`\n✓ Geschrieben: ${FILE}`);
console.log(`Translated: ${translated} · Failures: ${fails} · Tokens: ${totalIn} in + ${totalOut} out`);
console.log(`Cost: $${((totalIn / 1e6) * PRICING.in + (totalOut / 1e6) * PRICING.out).toFixed(5)}`);
process.exit(fails > 0 ? 1 : 0);
