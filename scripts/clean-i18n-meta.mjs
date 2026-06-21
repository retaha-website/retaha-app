// One-shot Cleaner: entfernt KI-Meta-Text ("Ich bin bereit, …", "I'm ready to
// translate …") aus den Ziel-Sprachblöcken von backoffice-strings.ts.
//
// Ursache: frühere Haiku-Läufe haben bei kurzen/imperativen DE-Strings den Input
// als Anweisung missverstanden und konversationell geantwortet statt zu übersetzen.
// Diese Antworten wurden als "Übersetzung" gespeichert.
//
// Strategie: pro Ziel-Sprache (NICHT de) jeden Wert prüfen. Treffer →
//   (a) englischer Meta-Satz ("I'm ready to translate", "please provide the …"), ODER
//   (b) deutsche Meta-Wörter in einer Nicht-DE-Sprache (eine fr/es/…-Übersetzung
//       darf NIE Deutsch sein → sicheres Kontaminations-Signal).
// Treffer werden GELÖSCHT → fehlen danach → Translate-Script füllt sie (gehärteter
// Prompt) korrekt nach.
//
// Run:  node scripts/clean-i18n-meta.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FILE = join(ROOT, 'packages/i18n/src/backoffice-strings.ts');

const TARGET_LANGS = ['en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh', 'tr'];
const ALL_LANGS = ['de', ...TARGET_LANGS];

function parseStrings() {
  const src = readFileSync(FILE, 'utf8');
  const m = src.match(/export const BO_STRINGS[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('Could not find BO_STRINGS object');
  return Function('return ' + m[1])();
}

// Starke konversationelle Meta-Signaturen (Modell hat geantwortet statt übersetzt).
// Bewusst spezifisch, damit legitime kurze UI-Strings ("I'm ready", "Please provide
// text.") NICHT fälschlich getroffen werden.
const META_RE = [
  /\bI('|’)?m ready to (translate|help|receive|assist)/i,
  /\bI am ready to (translate|help|receive|assist)/i,
  /you('|’)?d like (me )?to translate/i,
  /\bI('|’)?ll (translate|apply|respond|follow these|help you)/i,
  /\bI need (the german|more context|the complete)/i,
  /\bI (can('|’)?t|cannot) (provide|translate)/i,
  /\bI (don('|’)?t|do not) see (the|any|a) (german|text|ui)/i,
  /\bI notice (you|the input|that)/i,
  /could you (please )?(provide|clarify)/i,
  /awaiting your/i,
  /waiting for (your input|german text)/i,
  /ready to (help )?translate/i,
  /the german (ui )?text you('|’)?d like/i,
  /provide the (german|complete|button) (text|ui)/i,
  /following (all )?(your|the) (specified |detailed )?(rules|guidelines)/i,
  // andere Zielsprachen, konversationell
  /je suis prêt à (traduire|recevoir|aider)/i,
  /veuillez (me )?(fournir|donner|envoyer) le texte/i,
  /pourriez-vous (fournir|clarifier)/i,
  /estoy (listo|aquí) para (traducir|ayudar)/i,
  /por favor,? (proporcione|envíe|indique) el texto/i,
  /sono pronto a tradurre/i,
  /per favore,? fornisci(mi)? il testo/i,
  /manca il testo da tradurre/i,
  /estou pronto para traduzir/i,
  /preciso de (mais contexto|texto)/i,
  /ik ben klaar voor (de )?vertaling/i,
  /ik kan (alleen|geen)/i,
  /kunt u de (duitse|tekst)/i,
  /geef me (alstublieft|de duitse)/i,
  /я готов(а)? (переводить|помочь)/i,
  /мне нужен (контекст|текст|полный)/i,
  /пожалуйста,? (предоставьте|пришлите) текст/i,
  /أنا (مستعد|جاهز|هنا)/,
  /يرجى (تقديم|إرسال) النص/,
  /我(已|明白|理解|准备好)/,
  /请(提供|发送).*(文本|文字|德语)/,
  /çevirmeye hazır/i,
  /lütfen.*metni? (sağlay|gönder|ver)/i,
];

// Multilinguale Bestätigungs-Präfixe ("Understood. …", "Verstanden. …") am Anfang
const ACK_PREFIX = /^(understood|verstanden|begrepen|entendido|compris|capito|compreendido|понятно|понимаю|anladım|tamam|好的|明白|理解|مفهوم|فهمت)[.,!:\s]/i;

// Deutsche Meta-Wortgruppen — in einer NICHT-DE-Übersetzung = Kontamination
const GERMAN_META = [
  'übersetzen', 'übersetzt', 'Übersetzung', 'übertragen soll', 'übersetzen soll',
  'Bitte gib', 'Bitte geben Sie', 'Ich bin bereit', 'Ich warte', 'Ich übersetze',
  'den UI-Text', 'UI-Text,', 'UI-Texte', 'Deutsch-Text', 'deutschen UI-Text',
  'möchtest', 'zum Übersetzen', 'Entschuldigung', 'ich sehe keinen',
  'den ich ins', 'den zu übersetzenden', 'Verstanden',
];

function isMeta(lang, value, deValue) {
  if (typeof value !== 'string') return false;
  if (lang === 'de') return false; // DE = Source-of-Truth, vertrauenswürdig
  for (const re of META_RE) if (re.test(value)) return true;
  if (ACK_PREFIX.test(value)) return true;
  for (const w of GERMAN_META) if (value.includes(w)) return true;
  // Längen-Blowup: kurze DE-Quelle, aber Wert massiv länger → Meta-Antwort.
  // Schützt legitime Kurz-Strings via 35-Zeichen-Boden + 2.5×-Faktor.
  const d = (deValue || '').length;
  if (d <= 50 && value.length > 35 && value.length > d * 2.5) return true;
  return false;
}

const data = parseStrings();
const de = data.de ?? {};
const keys = Object.keys(de);

const result = { de };
let removed = 0;
const perLang = {};
const sampleKeys = new Set();

for (const lang of TARGET_LANGS) {
  result[lang] = { ...(data[lang] ?? {}) };
  let n = 0;
  for (const k of Object.keys(result[lang])) {
    if (isMeta(lang, result[lang][k], de[k])) {
      delete result[lang][k];
      n++; removed++; sampleKeys.add(k);
    }
  }
  perLang[lang] = n;
}

console.log('Entfernt pro Sprache:', JSON.stringify(perLang));
console.log('Gesamt entfernt:', removed);
console.log('Betroffene Keys (' + sampleKeys.size + '):', [...sampleKeys].sort().join(', '));

// ── Datei neu schreiben (identisches Format wie translate-Script) ──
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
console.log('✓ Geschrieben:', FILE);
