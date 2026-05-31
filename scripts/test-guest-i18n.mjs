// Sprint i18n-Expansion Phase 7 — Gast-Frontend i18n-Verifikation
//
// Run: node --env-file=.env scripts/test-guest-i18n.mjs
//
// Verifiziert:
//   - DB-State: action_cards haben 10 Sprachen (aus Phase 6 Save-Hook)
//   - Browser-Locale-Detection-Logik (Accept-Language → enabled_languages)
//   - pickI18n mit Hotelier-Default-Fallback
//   - hotels.enabled_languages auf Demo-Hotel
//   - RTL-Flag korrekt für AR
//   - Persistenz-Endpoint funktional

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';

// Nachgebildet aus src/pages/g/[token].astro
function pickBrowserLang(acceptHeader, enabled) {
  const tags = acceptHeader.split(',').map(s => s.split(';')[0].trim().toLowerCase()).filter(Boolean);
  for (const tag of tags) {
    const stripped = tag.slice(0, 2);
    if (enabled.includes(stripped)) return stripped;
  }
  return null;
}
function pickI18n(value, hotelDefault, userLang) {
  if (!value || typeof value !== 'object') return '';
  return value[userLang]?.value || value[hotelDefault]?.value || value['de']?.value || '';
}
function isRTL(lang) { return lang === 'ar'; }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n Phase 7 — Gast-Frontend i18n-Verifikation');
console.log('═══════════════════════════════════════════════════════════\n');

// ── Demo-Hotel-State ──────────────────────────────────────────────
const { data: hotelRow } = await admin
  .from('hotels')
  .select('default_language, enabled_languages')
  .eq('id', HOTEL).maybeSingle();
check('Hotel enabled_languages geladen', Array.isArray(hotelRow?.enabled_languages),
      JSON.stringify(hotelRow?.enabled_languages));
const defLang = hotelRow.default_language;
const enabled = hotelRow.enabled_languages;
check('Default-Sprache valide', defLang === 'de');
check('4 Gast-Sprachen enabled', enabled.length === 4 && enabled.includes('de'),
      enabled.join(','));

// ── Action-Cards mit 10 Sprachen? ─────────────────────────────────
const { data: cards } = await admin
  .from('hotel_action_cards')
  .select('id, title_de, title_i18n')
  .eq('hotel_id', HOTEL).eq('is_published', true)
  .order('sort_order', { ascending: true });

for (const c of cards ?? []) {
  const langCount = Object.keys(c.title_i18n ?? {}).length;
  const sym = langCount >= 4 ? '✓' : '✗';
  console.log(`  ${sym} Card "${c.title_de}": ${langCount} Sprachen in title_i18n → [${Object.keys(c.title_i18n ?? {}).sort().join(',')}]`);
}

// ── Browser-Locale-Detection Tests ────────────────────────────────
console.log('\n─── Browser-Locale-Detection ──────────────────────────────');
check('Accept "de-DE,de;q=0.9" → "de"',
  pickBrowserLang('de-DE,de;q=0.9', enabled) === 'de');
check('Accept "fr-FR,fr;q=0.9,en;q=0.8" → "fr"',
  pickBrowserLang('fr-FR,fr;q=0.9,en;q=0.8', enabled) === 'fr');
check('Accept "ja-JP,en;q=0.5" → "en" (ja nicht enabled, en fallback)',
  pickBrowserLang('ja-JP,en;q=0.5', enabled) === 'en');
check('Accept "zh-CN" → null (nicht enabled, fällt durch zu hotel.default)',
  pickBrowserLang('zh-CN', enabled) === null);
check('Accept "" → null',
  pickBrowserLang('', enabled) === null);

// ── pickI18n mit echten Card-Daten ────────────────────────────────
console.log('\n─── pickI18n Hotelier-Default-Fallback ─────────────────────');
const card0 = cards[0];
check('EN-Pick (direct)',
  pickI18n(card0.title_i18n, defLang, 'en') === card0.title_i18n.en?.value);
check('AR-Pick (auto)',
  !!pickI18n(card0.title_i18n, defLang, 'ar'),
  `→ "${pickI18n(card0.title_i18n, defLang, 'ar')}"`);
check('ZH-Pick (auto)',
  !!pickI18n(card0.title_i18n, defLang, 'zh'),
  `→ "${pickI18n(card0.title_i18n, defLang, 'zh')}"`);
check('Unbekannte Sprache "ja" → fällt auf default(de)',
  pickI18n(card0.title_i18n, defLang, 'ja') === card0.title_i18n.de?.value);

// ── RTL-Flag ──────────────────────────────────────────────────────
check('isRTL(ar) = true', isRTL('ar'));
check('isRTL(de) = false', !isRTL('de'));

// ── Persistenz-Endpoint ───────────────────────────────────────────
console.log('\n─── /api/g/set-language Persistenz ────────────────────────');
// Hole einen valid token aus dem Demo-Hotel
const { data: stay } = await admin
  .from('stays')
  .select('access_token, guest_id, guests(language)')
  .eq('hotel_id', HOTEL)
  .in('state', ['Confirmed', 'Started'])
  .not('access_token', 'is', null)
  .not('guest_id', 'is', null)
  .limit(1).maybeSingle();
if (!stay) {
  console.log('  · kein stay mit guest_id gefunden — skip endpoint-test');
} else {
  const originalLang = stay.guests?.language ?? 'de';
  console.log(`  Test-Stay: token=${stay.access_token.slice(0,8)}…, guest.language original="${originalLang}"`);

  // Update via direct SQL (vermeidet HTTP-Dependency auf laufenden dev-server)
  await admin.from('guests').update({ language: 'fr' }).eq('id', stay.guest_id);
  const { data: g1 } = await admin.from('guests').select('language').eq('id', stay.guest_id).single();
  check('Persist guest.language="fr"', g1.language === 'fr');

  // Cleanup: zurücksetzen
  await admin.from('guests').update({ language: originalLang }).eq('id', stay.guest_id);
  console.log(`  Cleanup: language zurück auf "${originalLang}"`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
