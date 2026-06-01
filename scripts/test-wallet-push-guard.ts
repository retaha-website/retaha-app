// Sprint Wallet · Phase 7 — Unit-Test für canSendPush()
//
// Verifiziert die kritische DSGVO-Regel:
//   Marketing → respektiert opted_out
//   Service   → ignoriert opted_out (Vertragserfüllung)
//   expired   → blockiert beides
//
// Run: npm run test:wallet-push-guard

import { canSendPush } from '../src/lib/wallet/push-guard';

interface Case {
  label: string;
  input: Parameters<typeof canSendPush>[0];
  expectCanSend: boolean;
  expectReasonContains?: string;
}

const cases: Case[] = [
  // ── Marketing ──────────────────────────────────────────────────────────
  {
    label: 'Marketing × active × consent-given → SEND',
    input: { state: 'active', marketingConsentGiven: true, pushType: 'marketing' },
    expectCanSend: true,
    expectReasonContains: 'consent_given',
  },
  {
    label: 'Marketing × active × NO consent → SKIP',
    input: { state: 'active', marketingConsentGiven: false, pushType: 'marketing' },
    expectCanSend: false,
    expectReasonContains: 'consent_missing',
  },
  {
    label: 'Marketing × opted_out × consent-given → SKIP (opted_out wins)',
    input: { state: 'opted_out', marketingConsentGiven: true, pushType: 'marketing' },
    expectCanSend: false,
    expectReasonContains: 'opted_out',
  },
  {
    label: 'Marketing × expired → SKIP',
    input: { state: 'expired', marketingConsentGiven: true, pushType: 'marketing' },
    expectCanSend: false,
    expectReasonContains: 'expired',
  },

  // ── Service (Vertragserfüllung — ignoriert Marketing-Consent + Opt-Out) ─
  {
    label: 'Service × active × consent-given → SEND',
    input: { state: 'active', marketingConsentGiven: true, pushType: 'service' },
    expectCanSend: true,
    expectReasonContains: 'service_push',
  },
  {
    label: 'Service × active × NO consent → SEND (Vertragserfüllung)',
    input: { state: 'active', marketingConsentGiven: false, pushType: 'service' },
    expectCanSend: true,
    expectReasonContains: 'service_push',
  },
  {
    label: 'Service × opted_out → SEND (Vertragserfüllung)',
    input: { state: 'opted_out', marketingConsentGiven: false, pushType: 'service' },
    expectCanSend: true,
    expectReasonContains: 'service_push',
  },
  {
    label: 'Service × expired → SKIP (Pass dauerhaft inaktiv)',
    input: { state: 'expired', marketingConsentGiven: true, pushType: 'service' },
    expectCanSend: false,
    expectReasonContains: 'expired',
  },
];

let failed = 0;
for (const c of cases) {
  const r = canSendPush(c.input);
  const canSendOK = r.canSend === c.expectCanSend;
  const reasonOK = c.expectReasonContains ? r.reason.includes(c.expectReasonContains) : true;
  const ok = canSendOK && reasonOK;
  const marker = ok ? '✓' : '✗';
  console.log(`${marker} ${c.label}`);
  console.log(`    canSend=${r.canSend} reason="${r.reason}"`);
  if (!ok) failed++;
}

console.log();
if (failed > 0) {
  console.error(`✗ ${failed}/${cases.length} tests FAILED`);
  process.exit(1);
}
console.log(`✓ all ${cases.length} tests passed — DSGVO-Push-Guard funktioniert`);
