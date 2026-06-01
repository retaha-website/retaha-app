// Sprint Wallet · Phase 11 — Variable-Preserve-Test für Auto-Translation
//
// Verifiziert dass {{first_name}} & Co die Translation-Pipeline überleben.
// Run: npm run test:marketing-translate-preserve
//
// Test 1: Unit-Test protectPlaceholders / restorePlaceholders (kein API-Call)
// Test 2: End-to-End mit echtem Haiku-Call (braucht ANTHROPIC_API_KEY)
//   → DE-Original "Hallo {{first_name}}!" → EN/FR/ES Übersetzungen
//   → Assertions: {{first_name}} bleibt unverändert in jeder Sprache
//
// Skip-Logik: wenn ANTHROPIC_API_KEY fehlt, läuft nur Test 1.

import { protectPlaceholders, restorePlaceholders, mergeAndTranslateMarketing } from '../src/lib/marketing/translate-with-vars';
import { getEnv } from '../src/lib/env';

const results: Array<{ label: string; pass: boolean; info?: string }> = [];
function assert(label: string, cond: boolean, info?: string) {
  results.push({ label, pass: cond, info });
  console.log(`${cond ? '✓' : '✗'} ${label}${info ? ' — ' + info : ''}`);
}

// ── Test 1: Unit-Tests (kein API-Call) ─────────────────────────────────────
console.log('=== protectPlaceholders / restorePlaceholders Unit-Tests ===');
{
  const { text, placeholders } = protectPlaceholders('Hallo {{first_name}}!');
  assert('Single placeholder → 1 sentinel', text === 'Hallo __VAR0__!' && placeholders.length === 1, `text="${text}"`);
}
{
  const { text, placeholders } = protectPlaceholders('Hallo {{first_name}}, dein {{visit_count}}. Besuch — {{hotel_name}}');
  assert('Drei Placeholders → 3 Sentinels',
    text === 'Hallo __VAR0__, dein __VAR1__. Besuch — __VAR2__' && placeholders.length === 3,
    `text="${text}"`);
  assert('Restore stellt Original wieder her',
    restorePlaceholders(text, placeholders) === 'Hallo {{first_name}}, dein {{visit_count}}. Besuch — {{hotel_name}}');
}
{
  const { text } = protectPlaceholders('Kein Placeholder hier.');
  assert('Text ohne Placeholders bleibt unverändert', text === 'Kein Placeholder hier.');
}
{
  const ph = ['{{first_name}}', '{{last_name}}'];
  const restored = restorePlaceholders('Welcome __VAR1__ __VAR0__ to our hotel!', ph);
  assert('Restore in beliebiger Reihenfolge', restored === 'Welcome {{last_name}} {{first_name}} to our hotel!');
}

// ── Test 2: End-to-End mit Haiku ───────────────────────────────────────────
console.log();
console.log('=== End-to-End: mergeAndTranslateMarketing mit Haiku-Translation ===');

if (!getEnv('ANTHROPIC_API_KEY')) {
  console.log('⚠ ANTHROPIC_API_KEY nicht gesetzt — End-to-End-Test übersprungen.');
} else {
  const original = 'Hallo {{first_name}}! Schön dich wieder bei {{hotel_name}} zu sehen.';
  console.log(`Original (de): "${original}"`);
  const res = await mergeAndTranslateMarketing(null, original, 'de', { logLabel: 'preserve-test' });

  // Verify Original-Slot existiert
  assert('Original-Slot (de) ist gesetzt', !!res.i18n.de && res.i18n.de.value === original);
  assert('Source-Marker auf "original"', res.i18n.de?.source === 'original');

  // Pro Sprache: prüfe dass beide Variables literal erhalten sind
  const langsToCheck: Array<'en' | 'fr' | 'es' | 'it' | 'nl' | 'pt' | 'ru' | 'ar' | 'zh'> = ['en', 'fr', 'es'];
  for (const lang of langsToCheck) {
    const translated = res.i18n[lang]?.value;
    if (!translated) {
      assert(`${lang}: Übersetzung existiert`, false, 'kein Slot');
      continue;
    }
    console.log(`  ${lang}: "${translated}"`);
    const hasFirstName = translated.includes('{{first_name}}');
    const hasHotelName = translated.includes('{{hotel_name}}');
    assert(`${lang}: {{first_name}} erhalten`,    hasFirstName);
    assert(`${lang}: {{hotel_name}} erhalten`,    hasHotelName);
    assert(`${lang}: keine __VARn__-Reste`,       !/__VAR\d+__/.test(translated));
    assert(`${lang}: Source-Marker auf "auto"`,   res.i18n[lang]?.source === 'auto');
  }

  console.log();
  console.log(`Cost: $${res.cost.estimatedUSD.toFixed(5)} for ${res.cost.languages.length} languages`);
}

// ── Summary ─────────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.pass).length;
console.log();
if (failed > 0) {
  console.error(`✗ ${failed}/${results.length} tests FAILED`);
  process.exit(1);
}
console.log(`✓ all ${results.length} tests passed`);
