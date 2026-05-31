// Sprint i18n-Expansion Phase 1 — Type-System + Helpers Test
//
// Run: node scripts/test-i18n-types.mjs
//
// Testet:
//   - LANGUAGES Konstante (10 Sprachen, korrekte Codes)
//   - isLanguageCode Type-Guard
//   - normalizeLanguage (strip 'de-DE'→'de', invalid→'de', null→'de')
//   - pickI18n Fallback: userLang → hotelDefault → 'de' → ''
//   - pickI18nString analog
//   - availableLanguages / missingLanguages / autoTranslatedLanguages

import {
  LANGUAGES, LANGUAGE_LABELS, DEFAULT_LANGUAGE, RTL_LANGUAGES,
  isRTL, isLanguageCode, normalizeLanguage, makeI18nEntry,
} from '../src/lib/i18n/types.ts';
import {
  pickI18n, pickI18nString,
  availableLanguages, missingLanguages, autoTranslatedLanguages,
} from '../src/lib/i18n/picker.ts';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n-Expansion Phase 1 — Test-Run');
console.log('═══════════════════════════════════════════════════════════');

// ── LANGUAGES constant ──────────────────────────────────────────────
check('LANGUAGES enthält 10 Sprachen', LANGUAGES.length === 10, `got: ${LANGUAGES.length}`);
check('LANGUAGES enthält de/en/fr/es', ['de','en','fr','es'].every(l => LANGUAGES.includes(l)));
check('LANGUAGES enthält neue: it/pt/nl/ru/ar/zh', ['it','pt','nl','ru','ar','zh'].every(l => LANGUAGES.includes(l)));
check('LANGUAGE_LABELS hat 10 Einträge', Object.keys(LANGUAGE_LABELS).length === 10);
check('LANGUAGE_LABELS.ar = native Arabisch', LANGUAGE_LABELS.ar === 'العربية');
check('LANGUAGE_LABELS.zh = native Chinesisch', LANGUAGE_LABELS.zh === '中文');

// ── RTL ────────────────────────────────────────────────────────────
check('isRTL(ar) = true', isRTL('ar'));
check('isRTL(de) = false', !isRTL('de'));
check('RTL_LANGUAGES nur ar', RTL_LANGUAGES.size === 1 && RTL_LANGUAGES.has('ar'));

// ── isLanguageCode Type-Guard ──────────────────────────────────────
check('isLanguageCode("de") = true', isLanguageCode('de'));
check('isLanguageCode("xx") = false', !isLanguageCode('xx'));
check('isLanguageCode(null) = false', !isLanguageCode(null));
check('isLanguageCode(42) = false', !isLanguageCode(42));

// ── normalizeLanguage ──────────────────────────────────────────────
check('normalizeLanguage("de-DE") = "de"', normalizeLanguage('de-DE') === 'de');
check('normalizeLanguage("zh-CN") = "zh"', normalizeLanguage('zh-CN') === 'zh');
check('normalizeLanguage("AR") = "ar"', normalizeLanguage('AR') === 'ar');
check('normalizeLanguage("xx") = "de"', normalizeLanguage('xx') === DEFAULT_LANGUAGE);
check('normalizeLanguage(null) = "de"', normalizeLanguage(null) === DEFAULT_LANGUAGE);
check('normalizeLanguage(undefined) = "de"', normalizeLanguage(undefined) === DEFAULT_LANGUAGE);
check('normalizeLanguage("") = "de"', normalizeLanguage('') === DEFAULT_LANGUAGE);

// ── pickI18n Fallback-Hierarchie ───────────────────────────────────
const fullI18n = {
  de: { value: 'Tisch draußen', source: 'original' },
  en: { value: 'Outdoor table', source: 'auto' },
  fr: { value: 'Table extérieure', source: 'auto' },
};

check('pickI18n direct match (en)',
  pickI18n(fullI18n, 'de', 'en') === 'Outdoor table');
check('pickI18n fallback userLang→hotelDefault',
  pickI18n(fullI18n, 'de', 'es') === 'Tisch draußen', // es fehlt, hotelDefault=de
  'es missing → fallback to de');
// Fallback-Chain: userLang('es') → hotelDefault('fr') → 'de' → ''
// Nur 'de' im Objekt → letzte Fallback-Stufe greift
check('pickI18n fallback userLang→hotelDefault→de',
  pickI18n({de:{value:'Nur DE',source:'original'}}, 'fr', 'es') === 'Nur DE',
  'es+fr fehlen, de da → fallback auf de');

// Edge: nur eine non-default Sprache → keine Fallback-Kette greift
check('pickI18n alle Fallbacks fehlen → ""',
  pickI18n({en:{value:'X',source:'original'}}, 'fr', 'es') === '',
  'es,fr,de fehlen — nur en da → ""');

check('pickI18n null → ""', pickI18n(null, 'de', 'en') === '');
check('pickI18n undefined → ""', pickI18n(undefined, 'de', 'en') === '');
check('pickI18n empty object → ""', pickI18n({}, 'de', 'en') === '');

// ── pickI18nString analog ──────────────────────────────────────────
const strs = { de: 'Bestätigen', en: 'Confirm', fr: 'Confirmer' };
check('pickI18nString direct (en)', pickI18nString(strs, 'de', 'en') === 'Confirm');
check('pickI18nString fallback (zh→de)', pickI18nString(strs, 'de', 'zh') === 'Bestätigen');
check('pickI18nString null → ""', pickI18nString(null, 'de', 'en') === '');

// ── availableLanguages / missingLanguages ──────────────────────────
const partial = {
  de: { value: 'A', source: 'original' },
  en: { value: 'B', source: 'auto' },
  fr: { value: '', source: 'auto' }, // empty value → counts as missing
  zh: { value: 'C', source: 'auto' },
};
const avail = availableLanguages(partial);
check('availableLanguages enthält de/en/zh', avail.length === 3 && avail.every(l => ['de','en','zh'].includes(l)),
  `got: [${avail.join(',')}]`);
check('availableLanguages preserves LANGUAGES-Order',
  JSON.stringify(avail) === JSON.stringify(['de','en','zh']));
check('availableLanguages skip empty value (fr)',
  !avail.includes('fr'));

const missing = missingLanguages(partial);
check('missingLanguages enthält fr (empty)', missing.includes('fr'));
check('missingLanguages enthält die 6 nicht-vorhandenen + fr',
  missing.length === 7, `got ${missing.length}: [${missing.join(',')}]`);
check('availableLanguages null → []', availableLanguages(null).length === 0);
check('missingLanguages null → alle 10', missingLanguages(null).length === 10);

// ── autoTranslatedLanguages ────────────────────────────────────────
const mixed = {
  de: { value: 'Master', source: 'original' },
  en: { value: 'Auto', source: 'auto' },
  fr: { value: 'Manual', source: 'override' },
  es: { value: 'Auto2', source: 'auto' },
};
const auto = autoTranslatedLanguages(mixed);
check('autoTranslatedLanguages = [en, es]',
  JSON.stringify(auto) === JSON.stringify(['en','es']),
  `got: [${auto.join(',')}]`);

// ── makeI18nEntry ─────────────────────────────────────────────────
const entry = makeI18nEntry('Hallo', 'original');
check('makeI18nEntry hat value', entry.value === 'Hallo');
check('makeI18nEntry hat source', entry.source === 'original');
check('makeI18nEntry hat updated_at (ISO)', /^\d{4}-\d{2}-\d{2}T/.test(entry.updated_at));
check('makeI18nEntry default source = original',
  makeI18nEntry('X').source === 'original');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
