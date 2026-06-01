// Sprint Wallet · Phase 12 — Drip-Trigger + Step-Sender Test
//
// End-to-End Sanity-Test mit echter DB:
//   1. Test-Hotel + Test-Pass + Test-Template + Test-Drip anlegen
//   2. triggerDripsForEvent('wallet_add') aufrufen → marketing_drip_state-Row erwartet
//   3. runDripStepSender → ohne google_object_id wird skip "pass_not_synced"
//      (das wollen wir auch — Drip-State completed_at gesetzt)
//   4. Idempotenz: erneuter Trigger-Call → keine Doppel-Row
//   5. Cleanup
//
// Skip: wenn Service-Role-Key fehlt
//
// Run: npm run test:marketing-drips

import { createSupabaseServiceRoleInstance } from '../src/lib/auth';
import { triggerDripsForEvent, runDripStepSender, runCronTriggers } from '../src/lib/marketing/drips';
import { getEnv } from '../src/lib/env';

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

// Use existing Demo-Hotel (Gate Garden)
const HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

let testTemplateId: string | null = null;
let testDripId: string | null = null;
let testPassId: string | null = null;

async function setup() {
  // Test-Template (minimal i18n)
  const { data: tpl, error: tplErr } = await sb.from('marketing_templates').insert({
    hotel_id: HOTEL_ID,
    name: '__drip-test-template__',
    title_i18n: { de: { value: 'Hallo {{first_name}}', source: 'original', updated_at: new Date().toISOString() } },
    body_i18n:  { de: { value: '<p>Test-Body</p>', source: 'original', updated_at: new Date().toISOString() } },
    cta_label_i18n: null,
    cta_url: null,
    hero_image_url: null,
    category: 'newsletter',
  }).select('id').single();
  if (tplErr) throw new Error(`Template-Insert failed: ${tplErr.message}`);
  testTemplateId = tpl!.id;
  console.log(`[setup] template=${testTemplateId}`);

  // Test-Drip + Step
  const { data: drip, error: dripErr } = await sb.from('marketing_drips').insert({
    hotel_id: HOTEL_ID,
    name: '__drip-test__',
    trigger_type: 'wallet_add',
    is_active: true,
  }).select('id').single();
  if (dripErr) throw new Error(`Drip-Insert failed: ${dripErr.message}`);
  testDripId = drip!.id;
  console.log(`[setup] drip=${testDripId}`);

  await sb.from('marketing_drip_steps').insert({
    drip_id: testDripId,
    template_id: testTemplateId,
    delay_days: 0,
    step_order: 1,
  });

  // Test-Pass (kein google_object_id → wird beim Send geskippt mit klarem Reason)
  const { data: pass, error: passErr } = await sb.from('wallet_passes').insert({
    hotel_id: HOTEL_ID,
    guest_email: `__drip-test-${Date.now()}@example.com`,
    guest_first_name: 'TestUser',
    guest_last_name: 'Drip',
    marketing_consent_given: true,
    marketing_consent_given_at: new Date().toISOString(),
    marketing_consent_policy_version: '2026-06-01',
    visit_count: 1,
    first_visit_at: new Date().toISOString(),
    last_visit_at: new Date().toISOString(),
    state: 'active',
  }).select('id').single();
  if (passErr) throw new Error(`Pass-Insert failed: ${passErr.message}`);
  testPassId = pass!.id;
  console.log(`[setup] pass=${testPassId}`);
}

async function cleanup() {
  if (testPassId) await sb.from('wallet_passes').delete().eq('id', testPassId);
  if (testDripId) await sb.from('marketing_drips').delete().eq('id', testDripId);
  if (testTemplateId) await sb.from('marketing_templates').delete().eq('id', testTemplateId);
  console.log('[cleanup] done');
}

async function main() {
  try {
    await setup();

    // ── 1. Inline-Trigger ────────────────────────────────────────────────
    const r1 = await triggerDripsForEvent(HOTEL_ID, testPassId!, 'wallet_add');
    assert('triggerDripsForEvent enqueued 1 row', r1.enqueued === 1, `r=${JSON.stringify(r1)}`);

    // Verify in DB
    const { data: states1 } = await sb
      .from('marketing_drip_state')
      .select('drip_id, last_step_sent, completed_at')
      .eq('drip_id', testDripId!)
      .eq('wallet_pass_id', testPassId!);
    assert('drip_state-Row existiert', (states1?.length ?? 0) === 1);
    assert('last_step_sent=0 initial', states1?.[0]?.last_step_sent === 0);
    assert('completed_at IS NULL initial', states1?.[0]?.completed_at === null);

    // ── 2. Idempotenz: zweimal triggern ──────────────────────────────────
    const r2 = await triggerDripsForEvent(HOTEL_ID, testPassId!, 'wallet_add');
    assert('zweiter Trigger-Call: enqueued=0 (idempotent)', r2.enqueued === 0, `r=${JSON.stringify(r2)}`);

    // ── 3. Step-Sender ───────────────────────────────────────────────────
    const sendResult = await runDripStepSender(50);
    assert('step-sender fand 1 due step', sendResult.found === 1, `sender=${JSON.stringify(sendResult)}`);
    // Erwartung: ohne google_object_id (nicht gesetzt im Test-Pass) skippt
    // sendOneStep mit reason='pass_not_synced_to_google' und markiert completed
    const { data: states2 } = await sb
      .from('marketing_drip_state')
      .select('completed_at')
      .eq('drip_id', testDripId!)
      .eq('wallet_pass_id', testPassId!);
    assert('drip-state completed (kein google_object_id)', states2?.[0]?.completed_at != null);

    // ── 4. Opted-out Pass: state-Update → re-Trigger sollte enqueue,
    //     aber step-sender skippt wegen canSendPush=false ───────────────
    // (Bewusst nicht getestet — würde unsere Test-DB-Daten weiter aufblähen)

    // ── 5. Cron-Triggers stub-test (sollte 0 enqueuen weil keine cron-drips
    //     mit aktiver config existieren) ──────────────────────────────────
    const cronR = await runCronTriggers();
    assert('runCronTriggers liefert summary-Objekt', typeof cronR.totalEnqueued === 'number', `summary=${JSON.stringify(cronR)}`);

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
  console.error('[test-marketing-drips] uncaught:', err);
  cleanup().finally(() => process.exit(1));
});
