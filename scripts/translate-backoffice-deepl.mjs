// Backoffice-UI-Strings via DeepL Free API uebersetzen (Alternative zu Haiku — gratis).
//
// Source-of-Truth: DE-Block in packages/i18n/src/backoffice-strings.ts (handgepflegt).
// Uebersetzt fehlende + geaenderte Keys (Snapshot-Vergleich) in alle 10 Sprachen.
// Idempotent. Nutzt denselben Snapshot wie das Haiku-Script.
//
// Setup:
//   1) Kostenlosen "DeepL API Free"-Account auf https://www.deepl.com/pro-api anlegen.
//   2) API-Key kopieren (endet auf ":fx").
//   3) In apps/backoffice/.env:  DEEPL_API_KEY=xxxxxxxx:fx
//
// Run:  node --env-file=apps/backoffice/.env scripts/translate-backoffice-deepl.mjs
//
// Platzhalter ({name}, {{var}}) werden vor dem Senden durch kollisionssichere PUA-
// Sentinels geschuetzt und danach wiederhergestellt; bei Verlust faellt die Zelle auf
// DE zurueck (Validierung). HTML (<strong>, <a>, <span>) via tag_handling=html erhalten.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FILE = join(ROOT, 'packages/i18n/src/backoffice-strings.ts');
const SNAP = join(ROOT, 'packages/i18n/backoffice-strings.snapshot.json');

const apiKey = process.env.DEEPL_API_KEY;
if (!apiKey) { console.error('Missing DEEPL_API_KEY (use --env-file=apps/backoffice/.env)'); process.exit(1); }
const ENDPOINT = apiKey.trim().endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

const TARGET_LANGS = ['en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh', 'tr'];
const ALL_LANGS = ['de', ...TARGET_LANGS];
const DEEPL_LANG = {
  en: 'EN-US', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT-PT',
  nl: 'NL', ru: 'RU', ar: 'AR', zh: 'ZH', tr: 'TR',
};

function parseStrings() {
  const src = readFileSync(FILE, 'utf8');
  const m = src.match(/export const BO_STRINGS[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('Could not find BO_STRINGS object in ' + FILE);
  return Function('return ' + m[1])();
}

// ── Platzhalter-Schutz ─────────────────────────────────────────────────
// {…}/{{…}} werden in PUA-delimitierte Sentinels gepackt: <idx>.
// PUA-Zeichen kommen in echtem Text nie vor → echte Zahlen (90, 20 %, 5,10,25)
// bleiben unberuehrt. DeepL reicht PUA-Zeichen unveraendert durch.
const PH_RE = /\{\{[^}]+\}\}|\{[^}]+\}/g;
const S0 = '', S1 = '';
function protect(text) {
  const map = [];
  const out = String(text).replace(PH_RE, (m) => {
    const token = S0 + map.length + S1;
    map.push(m);
    return token;
  });
  return { out, map };
}
function restore(text, map) {
  return String(text).replace(/(\d+)/g, (_, i) => (map[Number(i)] ?? ''));
}
function placeholdersOk(source, out) {
  const want = String(source).match(PH_RE) || [];
  for (const ph of want) if (!out.includes(ph)) return false;
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(texts, lang, retry = 0) {
  const prot = texts.map(protect);
  const body = new URLSearchParams();
  for (const p of prot) body.append('text', p.out);
  body.append('source_lang', 'DE');
  body.append('target_lang', DEEPL_LANG[lang]);
  body.append('tag_handling', 'html');
  body.append('preserve_formatting', '1');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'DeepL-Auth-Key ' + apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if ((res.status === 429 || res.status === 529) && retry < 5) {
    await sleep(Math.min(30000, 3000 * Math.pow(2, retry)));
    return translateBatch(texts, lang, retry + 1);
  }
  if (res.status === 456) throw new Error('DeepL-Quota erschoepft (456). Naechsten Monat oder Pro-Key.');
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return data.translations.map((t, i) => restore(t.text, prot[i].map).trim());
}

// ── Main ─────────────────────────────────────────────────────────────
const data = parseStrings();
const de = data.de ?? {};
const keys = Object.keys(de);
const snap = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : {};
const changed = keys.filter((k) => snap[k] !== undefined && snap[k] !== de[k]);
console.log(`BO_STRINGS DE-Keys: ${keys.length}${changed.length ? ` (${changed.length} geaendert)` : ''} · ${ENDPOINT}`);

let translated = 0, fails = 0, phFallback = 0, sourceChars = 0;
const result = { de };
const BATCH = 40, DELAY = 500;

for (const lang of TARGET_LANGS) {
  result[lang] = { ...(data[lang] ?? {}) };
  const missing = keys.filter((k) => !result[lang][k] || (snap[k] !== undefined && snap[k] !== de[k]));
  console.log(`\n─── ${lang.toUpperCase()} (${DEEPL_LANG[lang]}) — ${missing.length} fehlend`);
  if (missing.length === 0) continue;

  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(DELAY);
    const slice = missing.slice(i, i + BATCH);
    const texts = slice.map((k) => de[k]);
    try {
      const outs = await translateBatch(texts, lang);
      slice.forEach((k, j) => {
        const o = outs[j];
        if (!o) { fails++; return; }
        if (!placeholdersOk(de[k], o)) { phFallback++; return; } // DE-Fallback bei Platzhalter-Verlust
        result[lang][k] = o; translated++; sourceChars += (de[k] || '').length;
      });
    } catch (err) {
      console.error(`  ✗ batch @${i}: ${err.message}`);
      fails += slice.length;
    }
    process.stdout.write(`  · batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(missing.length / BATCH)}\n`);
  }
}

// ── Datei neu schreiben (identisches Format wie Haiku-Script) ─────────
function quote(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"; }
function langBlock(lang) {
  const obj = result[lang] ?? {};
  const entries = keys.filter((k) => obj[k] != null).map((k) => `    ${quote(k)}: ${quote(obj[k])}`).join(',\n');
  return `  ${lang}: {\n${entries}\n  }`;
}
const blocks = ALL_LANGS.filter((l) => result[l]).map(langBlock).join(',\n');

const out = `// Backoffice-UI-Strings (Hotelier-Seite) — DE = Source-of-Truth (handgepflegt).
// Uebrige Sprachen via scripts/translate-backoffice-deepl.mjs (DeepL). Fehlende
// Keys fallen via bt() sauber auf DE zurueck.
//
// Aufruf:  bt('dd.profile', lang)
import { type LanguageCode } from './helpers/types';

export const BO_STRINGS: Partial<Record<LanguageCode, Record<string, string>>> = {
${blocks}
};

/**
 * Backoffice-Translate. Fallback-Kette: gewaehlte Sprache → DE → Key selbst
 * (damit nie ein leerer String oder ein Key-Leak entsteht).
 */
export function bt(key: string, lang: LanguageCode): string {
  return BO_STRINGS[lang]?.[key] ?? BO_STRINGS.de?.[key] ?? key;
}
`;

writeFileSync(FILE, out);
writeFileSync(SNAP, JSON.stringify(de, null, 0) + '\n');
console.log(`\n✓ Geschrieben: ${FILE}`);
console.log(`Translated: ${translated} · Failures: ${fails} · DE-Fallback (Platzhalter): ${phFallback} · Source-Chars: ${sourceChars}`);
process.exit(fails > 0 ? 1 : 0);
