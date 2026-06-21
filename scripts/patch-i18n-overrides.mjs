// Manuelle i18n-Overrides für Keys, die der Haiku-Auto-Translator NICHT zuverlässig
// übersetzen kann — weil die DE-Quelle ultrakurz/mehrdeutig ist (Wochentags-Kürzel,
// Sprachnamen-Labels, knappe Hints). Diese Werte sind handgepflegt & stabil.
//
// Idempotent: bei Bedarf erneut ausführbar. Nach dem Auto-Translate laufen lassen,
// um Auto-Müll zu überschreiben. DE bleibt unangetastet (Source-of-Truth).
//
// Run:  node scripts/patch-i18n-overrides.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'packages/i18n/src/backoffice-strings.ts');
const src = readFileSync(FILE, 'utf8');
const data = Function('return ' + src.match(/export const BO_STRINGS[^=]*=\s*(\{[\s\S]*?\n\});/)[1])();

const L = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh', 'tr'];
// pro Key: [de, en, fr, es, it, pt, nl, ru, ar, zh, tr]  (de wird NICHT überschrieben)
const OVERRIDES = {
  // Wochentags-Kürzel
  'si.day.mon': ['Mo', 'Mon', 'Lun', 'Lun', 'Lun', 'Seg', 'Ma', 'Пн', 'الاثنين', '周一', 'Pzt'],
  'si.day.tue': ['Di', 'Tue', 'Mar', 'Mar', 'Mar', 'Ter', 'Di', 'Вт', 'الثلاثاء', '周二', 'Sal'],
  'si.day.wed': ['Mi', 'Wed', 'Mer', 'Mié', 'Mer', 'Qua', 'Wo', 'Ср', 'الأربعاء', '周三', 'Çar'],
  'si.day.thu': ['Do', 'Thu', 'Jeu', 'Jue', 'Gio', 'Qui', 'Do', 'Чт', 'الخميس', '周四', 'Per'],
  'si.day.fri': ['Fr', 'Fri', 'Ven', 'Vie', 'Ven', 'Sex', 'Vr', 'Пт', 'الجمعة', '周五', 'Cum'],
  'si.day.sat': ['Sa', 'Sat', 'Sam', 'Sáb', 'Sab', 'Sáb', 'Za', 'Сб', 'السبت', '周六', 'Cmt'],
  'si.day.sun': ['So', 'Sun', 'Dim', 'Dom', 'Dom', 'Dom', 'Zo', 'Вс', 'الأحد', '周日', 'Paz'],
  // Sprachnamen-Labels (zweisprachiger Self-Checkout-Notiz-Editor)
  'sc.note.de': ['Deutsch', 'German', 'Allemand', 'Alemán', 'Tedesco', 'Alemão', 'Duits', 'Немецкий', 'الألمانية', '德语', 'Almanca'],
  'sc.note.en': ['English', 'English', 'Anglais', 'Inglés', 'Inglese', 'Inglês', 'Engels', 'Английский', 'الإنجليزية', '英语', 'İngilizce'],
  // Knappe Hints (Auto-Translator antwortet sonst meta)
  'ac.modal.subtitlehint': ['(2–3 Sätze)', '(2–3 sentences)', '(2–3 phrases)', '(2–3 frases)', '(2–3 frasi)', '(2–3 frases)', '(2–3 zinnen)', '(2–3 предложения)', '(2–3 جُمل)', '(2–3 句)', '(2–3 cümle)'],
  'ac.modal.eyebrowhint': ['(z.B. „Morgen Mittag")', '(e.g. "Tomorrow noon")', '(p. ex. « Demain midi »)', '(p. ej. «Mañana al mediodía»)', '(es. «Domani a mezzogiorno»)', '(ex.: «Amanhã ao meio-dia»)', '(bijv. "Morgenmiddag")', '(напр. «Завтра в полдень»)', '(مثلاً „غداً ظهراً")', '(例如"明天中午")', '(örn. "Yarın öğlen")'],
};

let changed = 0;
for (const [key, vals] of Object.entries(OVERRIDES)) {
  L.forEach((l, i) => {
    if (l === 'de') return; // Source-of-Truth nicht überschreiben
    if (!vals[i]) return;
    data[l] = data[l] || {};
    if (data[l][key] !== vals[i]) { data[l][key] = vals[i]; changed++; }
  });
}

const keys = Object.keys(data.de);
function quote(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"; }
function langBlock(l) {
  const o = data[l] || {};
  const e = keys.filter(k => o[k] != null).map(k => `    ${quote(k)}: ${quote(o[k])}`).join(',\n');
  return `  ${l}: {\n${e}\n  }`;
}
const blocks = L.filter(l => data[l]).map(langBlock).join(',\n');
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
console.log(`✓ Overrides angewendet (${changed} Zellen geändert, ${Object.keys(OVERRIDES).length} Keys)`);
