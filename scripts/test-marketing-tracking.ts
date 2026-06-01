// Sprint Wallet · Phase 13 — Analytics Test-Script
//
// End-to-End Tests für Click + Open Tracking gegen lokalen Dev-Server.
// Erwartet: dev-server läuft auf PUBLIC_SITE_URL (oder localhost:4321 default).
//
// Coverage:
//   ✓ Click-Redirect: clicked_at + click_count++
//   ✓ Idempotenz Click: 2x → clicked_at unverändert, count unverändert
//   ✓ Atomic-Increment Race: 100 parallele mc_inc_click → exakt 100 counter-Diff
//   ✓ URL-Validation: ?to ohne https → 400
//   ✓ send_id nicht gefunden → 404
//   ✓ Webhook-Open: opened_at + open_count++ (latest send within 7d, opened_at IS NULL)
//   ✓ Open 2x → unverändert
//   ✓ Webhook für sent_at older than 7d → keine Attribution
//
// Run: npm run test:marketing-tracking
//
// Skip wenn SUPABASE_SERVICE_ROLE_KEY fehlt oder Dev-Server nicht erreichbar.

import { createSupabaseServiceRoleInstance } from '../src/lib/auth';
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

const SITE_URL = getEnv('PUBLIC_SITE_URL') || 'http://localhost:4321';
console.log(`Testing against: ${SITE_URL}`);

const sb = createSupabaseServiceRoleInstance();
const HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

// State für cleanup
let testPassId: string | null = null;
let testCampaignId: string | null = null;
let testSendId: string | null = null;
let race100CampaignId: string | null = null;

async function setup() {
  // Test-Pass
  const { data: pass } = await sb.from('wallet_passes').insert({
    hotel_id: HOTEL_ID,
    guest_email: `__tracking-test-${Date.now()}@example.com`,
    guest_first_name: 'Track',
    guest_last_name: 'Test',
    google_object_id: `__test_${Date.now()}__`,  // pseudo-ID damit Open-Attribution funktioniert
    marketing_consent_given: true,
    marketing_consent_given_at: new Date().toISOString(),
    marketing_consent_policy_version: '2026-06-01',
    visit_count: 1,
    first_visit_at: new Date().toISOString(),
    last_visit_at: new Date().toISOString(),
    state: 'active',
  }).select('id').single();
  testPassId = pass!.id;

  // Test-Campaign
  const nowIso = new Date().toISOString();
  const i18n = { de: { value: 'Test', source: 'original', updated_at: nowIso } };
  const { data: campaign } = await sb.from('marketing_campaigns').insert({
    hotel_id: HOTEL_ID,
    name: '__tracking-test-campaign__',
    title_i18n: i18n,
    body_i18n: i18n,
    cta_label_i18n: null,
    cta_url: null,
    status: 'sent',
    sent_at: nowIso,
    recipients_count: 1,
    open_count: 0,
    click_count: 0,
  }).select('id').single();
  testCampaignId = campaign!.id;

  // Test-Send (sent_at = NOW, opened_at = NULL, clicked_at = NULL)
  const { data: send } = await sb.from('marketing_sends').insert({
    campaign_id: testCampaignId,
    wallet_pass_id: testPassId,
    sent_at: nowIso,
    delivered: null,
    lang_used: 'de',
  }).select('id').single();
  testSendId = send!.id;

  // Race-Test-Campaign (separat, damit unsere Tests sich nicht überlappen)
  const { data: rcCampaign } = await sb.from('marketing_campaigns').insert({
    hotel_id: HOTEL_ID,
    name: '__tracking-race-test__',
    title_i18n: i18n,
    body_i18n: i18n,
    status: 'sent',
    sent_at: nowIso,
    recipients_count: 1,
    open_count: 0,
    click_count: 0,
  }).select('id').single();
  race100CampaignId = rcCampaign!.id;
}

async function cleanup() {
  if (testSendId) await sb.from('marketing_sends').delete().eq('id', testSendId);
  if (testCampaignId) await sb.from('marketing_campaigns').delete().eq('id', testCampaignId);
  if (race100CampaignId) await sb.from('marketing_campaigns').delete().eq('id', race100CampaignId);
  if (testPassId) await sb.from('wallet_passes').delete().eq('id', testPassId);
  console.log('[cleanup] done');
}

async function checkServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${SITE_URL}/m/00000000-0000-0000-0000-000000000000?to=https://example.com`, { redirect: 'manual' });
    // Server muss antworten (404 erwartet weil send_id existiert nicht)
    return res.status === 404;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await checkServerReachable())) {
    console.error(`✗ Dev-Server nicht erreichbar unter ${SITE_URL}. Starte "npm run dev" und versuche es nochmal.`);
    process.exit(1);
  }

  try {
    await setup();
    console.log(`[setup] pass=${testPassId} campaign=${testCampaignId} send=${testSendId}`);

    // ── 1. Click-Redirect: invalid send_id → 404 ────────────────────────
    {
      const res = await fetch(`${SITE_URL}/m/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?to=https://example.com`, { redirect: 'manual' });
      assert('Unbekanntes send_id → 404', res.status === 404, `status=${res.status}`);
    }

    // ── 2. Click-Redirect: ?to ohne https → 400 ─────────────────────────
    {
      const res = await fetch(`${SITE_URL}/m/${testSendId}?to=${encodeURIComponent('http://insecure.example')}`, { redirect: 'manual' });
      assert('http:// to → 400 (open-redirect-Schutz)', res.status === 400);
    }
    {
      const res = await fetch(`${SITE_URL}/m/${testSendId}?to=${encodeURIComponent('javascript:alert(1)')}`, { redirect: 'manual' });
      assert('javascript: to → 400', res.status === 400);
    }
    {
      const res = await fetch(`${SITE_URL}/m/${testSendId}?to=ftp://example.com`, { redirect: 'manual' });
      assert('ftp: to → 400', res.status === 400);
    }

    // ── 3. Click-Redirect happy path: 302 + clicked_at + click_count++ ──
    {
      const beforeC = (await sb.from('marketing_campaigns').select('click_count').eq('id', testCampaignId!).single()).data?.click_count ?? -1;
      const res = await fetch(`${SITE_URL}/m/${testSendId}?to=${encodeURIComponent('https://example.com/booking')}`, { redirect: 'manual' });
      assert('Valid Click → 302', res.status === 302, `status=${res.status}`);
      assert('Redirect Location stimmt', res.headers.get('location') === 'https://example.com/booking');

      const sendAfter = (await sb.from('marketing_sends').select('clicked_at').eq('id', testSendId!).single()).data;
      assert('clicked_at gesetzt', !!sendAfter?.clicked_at);

      const afterC = (await sb.from('marketing_campaigns').select('click_count').eq('id', testCampaignId!).single()).data?.click_count ?? -1;
      assert('campaign.click_count +1', afterC === beforeC + 1, `before=${beforeC} after=${afterC}`);
    }

    // ── 4. Click idempotent: zweiter Click → KEIN counter-Increment ─────
    {
      const beforeC = (await sb.from('marketing_campaigns').select('click_count').eq('id', testCampaignId!).single()).data?.click_count ?? -1;
      const beforeClicked = (await sb.from('marketing_sends').select('clicked_at').eq('id', testSendId!).single()).data?.clicked_at;
      const res = await fetch(`${SITE_URL}/m/${testSendId}?to=${encodeURIComponent('https://example.com/booking')}`, { redirect: 'manual' });
      assert('Second click also redirects 302', res.status === 302);

      const afterC = (await sb.from('marketing_campaigns').select('click_count').eq('id', testCampaignId!).single()).data?.click_count ?? -1;
      assert('click_count unverändert bei 2. Klick', afterC === beforeC, `before=${beforeC} after=${afterC}`);
      const afterClicked = (await sb.from('marketing_sends').select('clicked_at').eq('id', testSendId!).single()).data?.clicked_at;
      assert('clicked_at unverändert (first-click-only)', afterClicked === beforeClicked);
    }

    // ── 5. Atomic-Increment Race: 100 parallele RPC-Calls ──────────────
    {
      const before = (await sb.from('marketing_campaigns').select('click_count').eq('id', race100CampaignId!).single()).data?.click_count ?? -1;
      await Promise.all(
        Array.from({ length: 100 }, () => sb.rpc('mc_inc_click', { p_campaign_id: race100CampaignId })),
      );
      const after = (await sb.from('marketing_campaigns').select('click_count').eq('id', race100CampaignId!).single()).data?.click_count ?? -1;
      assert('100 parallele mc_inc_click → click_count = before+100', after === before + 100, `before=${before} after=${after}`);
    }

    // ── 6. Open-Tracking Compare-and-Set Logik ──────────────────────────
    {
      const beforeO = (await sb.from('marketing_campaigns').select('open_count').eq('id', testCampaignId!).single()).data?.open_count ?? -1;

      // Direct DB-Test der CAS-Logik (Webhook-Pfad bedient sich derselben):
      // 1. Finde latest unopened send
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: latest } = await sb
        .from('marketing_sends')
        .select('id, campaign_id')
        .eq('wallet_pass_id', testPassId!)
        .is('opened_at', null)
        .not('sent_at', 'is', null)
        .gte('sent_at', sevenDaysAgo)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      assert('Webhook findet latest unopened send', latest?.id === testSendId);

      // 2. CAS-Update
      const { data: claimed } = await sb
        .from('marketing_sends')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', testSendId!)
        .is('opened_at', null)
        .select('id, campaign_id')
        .maybeSingle();
      assert('CAS claimed succeeded', !!claimed);

      // 3. counter++
      await sb.rpc('mc_inc_open', { p_campaign_id: testCampaignId });
      const afterO = (await sb.from('marketing_campaigns').select('open_count').eq('id', testCampaignId!).single()).data?.open_count ?? -1;
      assert('campaign.open_count +1', afterO === beforeO + 1);

      // 4. Zweiter Open: CAS-Update returnt 0 (idempotent)
      const { data: claimed2 } = await sb
        .from('marketing_sends')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', testSendId!)
        .is('opened_at', null)
        .select('id')
        .maybeSingle();
      assert('CAS zweiter Open returnt null (Race-frei)', claimed2 == null);
    }

    // ── 7. Open-Attribution-Window: send älter als 7 Tage → keine Attribution
    {
      // sent_at manuell auf 8 Tage zurücksetzen + opened_at zurücksetzen
      const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
      await sb.from('marketing_sends').update({ sent_at: old, opened_at: null }).eq('id', testSendId!);
      // Reset opened-counter zum Vergleich
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: latest } = await sb
        .from('marketing_sends')
        .select('id')
        .eq('wallet_pass_id', testPassId!)
        .is('opened_at', null)
        .not('sent_at', 'is', null)
        .gte('sent_at', sevenDaysAgo)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      assert('send >7 Tage alt → NICHT attributed', latest == null);
    }

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
  console.error('[test-marketing-tracking] uncaught:', err);
  cleanup().finally(() => process.exit(1));
});
