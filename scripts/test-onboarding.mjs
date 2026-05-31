// Sprint Functional Modul B — Onboarding E2E
//
// Run: node --env-file=.env scripts/test-onboarding.mjs
//
// Test-Flow:
//   1. Test-Hotel "Wizard-Test-Hotel" anlegen (leer)
//   2. onboarding_state INSERT
//   3. Checkliste laden — sollte mehrere "false" zeigen
//   4. Wizard-Step "languages" simulieren → step_languages=true
//   5. Wizard-Step "address" simulieren + Geocoding manuell
//   6. Cleanup: alles weg
//
// Plus: Verify Demo-Hotel hat completed_at gesetzt (Backfill).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO = '1f30ac02-17e1-47b6-9bda-487e14b07627';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Functional Modul B — Onboarding E2E');
console.log('═══════════════════════════════════════════════════════════');

// ── 1) Demo-Hotel: Backfill verifiziert ───────────────────────
const { data: demoState } = await sb.from('onboarding_state')
  .select('completed_at, step_eve_knowledge, step_action_cards')
  .eq('hotel_id', DEMO).maybeSingle();
check('Demo-Hotel hat onboarding_state-Eintrag', !!demoState);
check('Demo-Hotel hat completed_at (Backfill)', !!demoState?.completed_at);
check('Demo-Hotel: step_action_cards=true', demoState?.step_action_cards === true);

// ── 2) Test-Hotel anlegen ─────────────────────────────────────
const testSlug = 'onboarding-test-' + Math.floor(performance.now()).toString(36);
const { data: testHotel, error: hErr } = await sb.from('hotels')
  .insert({ name: 'Onboarding-Test-Hotel', slug: testSlug, default_language: 'de', enabled_languages: ['de'] })
  .select('id').single();
if (hErr) { console.error('Test-Hotel-Create fail:', hErr); process.exit(1); }
console.log(`Test-Hotel: ${testHotel.id.slice(0,8)}…`);

// Pflicht-FK: hotel_settings
await sb.from('hotel_settings').insert({ hotel_id: testHotel.id });

// ── 3) onboarding_state für Test-Hotel anlegen ────────────────
const { data: testState } = await sb.from('onboarding_state')
  .insert({ hotel_id: testHotel.id })
  .select('*').single();
check('Test onboarding_state angelegt', !!testState);
check('Test: alle steps default false', !testState.step_languages && !testState.step_address);
check('Test: completed_at null', testState.completed_at === null);

// ── 4) Wizard simulieren: Step "languages" ────────────────────
await sb.from('hotels').update({ default_language: 'de', enabled_languages: ['de','en'] }).eq('id', testHotel.id);
await sb.from('onboarding_state').update({ step_languages: true }).eq('hotel_id', testHotel.id);

const { data: afterLangs } = await sb.from('onboarding_state').select('step_languages').eq('hotel_id', testHotel.id).single();
check('Nach Wizard-languages: step_languages=true', afterLangs.step_languages === true);

// ── 5) Wizard simulieren: Step "address" ─────────────────────
await sb.from('hotels').update({
  address_street: 'Teststr 1', address_zip: '10115', city: 'Berlin', country: 'Deutschland',
  latitude: 52.52, longitude: 13.40,
}).eq('id', testHotel.id);
await sb.from('onboarding_state').update({ step_address: true }).eq('hotel_id', testHotel.id);

// ── 6) Checkliste-Logik simulieren ────────────────────────────
// (Mirror der checklist.ts Logik, vereinfacht für Test)
const [hot, set, brk, knw, ac, pp, hu] = await Promise.all([
  sb.from('hotels').select('name, address_street, city, latitude, longitude, default_language, enabled_languages').eq('id', testHotel.id).maybeSingle(),
  sb.from('hotel_settings').select('wifi_ssid, wifi_password').eq('hotel_id', testHotel.id).maybeSingle(),
  sb.from('breakfast_items').select('id', { count: 'exact', head: true }).eq('hotel_id', testHotel.id),
  sb.from('eve_knowledge').select('id', { count: 'exact', head: true }).eq('hotel_id', testHotel.id),
  sb.from('hotel_action_cards').select('id', { count: 'exact', head: true }).eq('hotel_id', testHotel.id),
  sb.from('hotel_place_picks').select('id', { count: 'exact', head: true }).eq('hotel_id', testHotel.id),
  sb.from('hotel_users').select('id', { count: 'exact', head: true }).eq('hotel_id', testHotel.id),
]);
const items = {
  basics: !!hot.data?.name,
  address: !!(hot.data?.address_street && hot.data?.city && typeof hot.data?.latitude === 'number'),
  languages: Array.isArray(hot.data?.enabled_languages) && hot.data.enabled_languages.length > 0,
  wifi: !!(set.data?.wifi_ssid && set.data?.wifi_password),
  breakfast: (brk.count ?? 0) > 0,
  knowledge: (knw.count ?? 0) >= 3,
  action_cards: (ac.count ?? 0) >= 1,
  place_picks: (pp.count ?? 0) >= 3,
};
console.log('\nTest-Hotel Checkliste (Read-Time):');
for (const [k, v] of Object.entries(items)) {
  console.log(`  ${v ? '✓' : '○'} ${k}`);
}
check('Checkliste: basics + address + languages done', items.basics && items.address && items.languages);
check('Checkliste: knowledge/action_cards/place_picks NICHT done (leeres Test-Hotel)',
  !items.knowledge && !items.action_cards && !items.place_picks,
  `knowledge=${items.knowledge} cards=${items.action_cards} picks=${items.place_picks}`);
// (wifi/breakfast können DB-Defaults haben, daher nicht im strict-Check)

// ── Cleanup ───────────────────────────────────────────────────
await sb.from('hotels').delete().eq('id', testHotel.id); // CASCADE räumt settings + onboarding_state mit
console.log('\nCleanup: Test-Hotel entfernt (CASCADE)');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
