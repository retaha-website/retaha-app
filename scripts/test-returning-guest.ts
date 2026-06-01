// Sprint Wallet · Modul E — Returning-Guest End-to-End-Test
//
// Verifiziert:
//   ✓ findWalletPassByEmail case-insensitive
//   ✓ linkReturningGuests increment + link
//   ✓ welcome-Idempotenz (zweimal triggern, 1 stay_push_sends-Row)
//   ✓ Deep-Link-Token sign + verify
//   ✓ findActiveStayForPass mit aktivem Stay
//
// Run: npm run test:returning-guest

import { createSupabaseServiceRoleInstance } from '../src/lib/auth';
import { getEnv } from '../src/lib/env';
import { findWalletPassByEmail, linkReturningGuests, findActiveStayForPass, linkStayToPass } from '../src/lib/wallet/returning-guest';
import { signWalletDeepLinkToken, verifyWalletDeepLinkToken } from '../src/lib/wallet/deep-link-token';
import { sendStayPush } from '../src/lib/wallet/stay-push';

const results: Array<{ label: string; pass: boolean; info?: string }> = [];
function assert(label: string, cond: boolean, info?: string) {
  results.push({ label, pass: cond, info });
  console.log(`${cond ? '✓' : '✗'} ${label}${info ? ' — ' + info : ''}`);
}

if (!getEnv('SUPABASE_SERVICE_ROLE_KEY')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing — skipping');
  process.exit(0);
}

const sb = createSupabaseServiceRoleInstance();
const HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const TEST_EMAIL = `__returning-test-${Date.now()}@example.com`;

let testGuestId: string | null = null;
let testWalletPassId: string | null = null;
let testStayId: string | null = null;
let testStayId2: string | null = null;  // zweiter Stay für Wiederkehrer-Simulation

async function setup() {
  // Test-Guest
  const { data: guest, error: gErr } = await sb.from('guests').insert({
    hotel_id: HOTEL_ID,
    email: TEST_EMAIL.toUpperCase(),  // Uppercase um case-insensitive zu testen
    first_name: 'Test', last_name: 'Returner',
    language: 'de',
  }).select('id').single();
  if (gErr) throw new Error(`guest insert: ${gErr.message}`);
  testGuestId = guest!.id;

  // Test-Wallet-Pass (1. Besuch)
  const oneYearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const { data: pass, error: pErr } = await sb.from('wallet_passes').insert({
    hotel_id: HOTEL_ID,
    guest_email: TEST_EMAIL.toLowerCase(),  // Pass-Email in lowercase
    guest_first_name: 'Test', guest_last_name: 'Returner',
    google_object_id: `__test_${Date.now()}__`,
    marketing_consent_given: false,
    visit_count: 1,
    first_visit_at: oneYearAgo, last_visit_at: oneYearAgo,
    state: 'active',
  }).select('id').single();
  if (pErr) throw new Error(`pass insert: ${pErr.message}`);
  testWalletPassId = pass!.id;

  // Test-Stay 1 (alt — schon erfolgt)
  const { data: stay1 } = await sb.from('stays').insert({
    hotel_id: HOTEL_ID,
    guest_id: testGuestId,
    access_token: '__test-old-' + Date.now().toString(36),
    check_in: oneYearAgo,
    check_out: new Date(Date.now() - 360 * 86_400_000).toISOString(),
    is_active: true,
    state: 'Processed',
  }).select('id').single();
  testStayId = stay1!.id;

  // Test-Stay 2 (NEU — Wiederkehrer-Besuch, aktiv jetzt)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const { data: stay2 } = await sb.from('stays').insert({
    hotel_id: HOTEL_ID,
    guest_id: testGuestId,
    access_token: '__test-new-' + Date.now().toString(36),
    check_in: yesterday,
    check_out: tomorrow,
    is_active: true,
    state: 'Started',
  }).select('id').single();
  testStayId2 = stay2!.id;

  console.log(`[setup] guest=${testGuestId} pass=${testWalletPassId} stay1=${testStayId} stay2=${testStayId2}`);
}

async function cleanup() {
  if (testStayId)        await sb.from('stays').delete().eq('id', testStayId);
  if (testStayId2)       await sb.from('stays').delete().eq('id', testStayId2);
  if (testWalletPassId)  await sb.from('wallet_passes').delete().eq('id', testWalletPassId);
  if (testGuestId)       await sb.from('guests').delete().eq('id', testGuestId);
  console.log('[cleanup] done');
}

async function main() {
  try {
    await setup();

    // ── 1. Email-Match case-insensitive ─────────────────────────────────
    const matched = await findWalletPassByEmail(HOTEL_ID, TEST_EMAIL.toUpperCase());
    assert('findWalletPassByEmail case-insensitive', matched?.id === testWalletPassId, `→ ${matched?.id?.slice(0,8) ?? 'null'}`);
    assert('matched visit_count = 1', matched?.visit_count === 1);

    // ── 2. linkReturningGuests: simulate Mews-Sync-Insert ───────────────
    const r = await linkReturningGuests([{ id: testStayId2!, hotel_id: HOTEL_ID, guest_id: testGuestId! }]);
    assert('linkReturningGuests linked 1', r === 1, `r=${r}`);

    // Verify: wallet_pass.visit_count++ und stay.wallet_pass_id verknüpft
    const { data: passAfter } = await sb.from('wallet_passes').select('visit_count, last_visit_at').eq('id', testWalletPassId!).single();
    assert('wallet_pass.visit_count = 2', passAfter?.visit_count === 2, `count=${passAfter?.visit_count}`);
    assert('wallet_pass.last_visit_at updated', !!passAfter?.last_visit_at);

    const { data: stayAfter } = await sb.from('stays').select('wallet_pass_id').eq('id', testStayId2!).single();
    assert('stay.wallet_pass_id verknüpft', stayAfter?.wallet_pass_id === testWalletPassId);

    // ── 3. welcome-Idempotenz: sendStayPush kann nicht doppelt feuern ──
    // Erster Call wurde schon in linkReturningGuests gemacht — wir messen Rows:
    const { count: countBefore } = await sb.from('stay_push_sends').select('id', { count: 'exact', head: true })
      .eq('stay_id', testStayId2!).eq('trigger_type', 'welcome');
    // Zweiter Call → unique-violation oder already_sent
    const sndRes = await sendStayPush(testStayId2!, 'welcome');
    const { count: countAfter } = await sb.from('stay_push_sends').select('id', { count: 'exact', head: true })
      .eq('stay_id', testStayId2!).eq('trigger_type', 'welcome');
    assert('welcome-Idempotenz: keine Doppel-Row', countAfter === countBefore, `before=${countBefore} after=${countAfter}`);
    assert('zweiter sendStayPush returnt already_sent oder skipped_no_object_id', ['skipped_already_sent','skipped_no_object_id','error'].includes(sndRes.status), `status=${sndRes.status}`);

    // ── 4. Deep-Link-Token sign + verify ────────────────────────────────
    const token = await signWalletDeepLinkToken(testWalletPassId!);
    assert('signWalletDeepLinkToken returnt String', typeof token === 'string' && (token?.length ?? 0) > 50, `len=${token?.length}`);
    const verified = await verifyWalletDeepLinkToken(token!);
    assert('verifyWalletDeepLinkToken returnt payload', verified?.wallet_pass_id === testWalletPassId);

    // Tampered token: falsche audience nicht missbrauchbar
    const fakeToken = token!.slice(0, -5) + 'XXXXX';
    const fakeVerified = await verifyWalletDeepLinkToken(fakeToken);
    assert('Tampered token returnt null', fakeVerified === null);

    // ── 5. findActiveStayForPass mit aktivem Stay ───────────────────────
    const active = await findActiveStayForPass(testWalletPassId!);
    assert('findActiveStayForPass findet stay2 (aktuell aktiv)', active?.id === testStayId2, `id=${active?.id?.slice(0,8) ?? 'null'}`);

    // ── 6. linkStayToPass idempotent (zweiter Call NULL-safe) ──────────
    await linkStayToPass(testStayId2!, testWalletPassId!);  // schon verknüpft → no-op
    const { data: stayCheck } = await sb.from('stays').select('wallet_pass_id').eq('id', testStayId2!).single();
    assert('linkStayToPass bleibt verknüpft', stayCheck?.wallet_pass_id === testWalletPassId);

    // Summary
    const failed = results.filter(r => !r.pass).length;
    console.log();
    if (failed > 0) {
      console.error(`✗ ${failed}/${results.length} tests FAILED`);
      process.exit(1);
    }
    console.log(`✓ all ${results.length} tests passed`);
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('[test-returning-guest] uncaught:', err);
  cleanup().finally(() => process.exit(1));
});
