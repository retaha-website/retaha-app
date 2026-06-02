// Sprint Wallet · Phase 12 — Drip-Cron (Trigger-Detection + Step-Sender)
//
// Schedule: 1× täglich (z.B. 09:00 UTC = 10:00/11:00 Berlin je nach DST)
// Auth: Bearer ${CRON_SECRET}
// Kill-Switch: MARKETING_ENABLED='true'
//
// Zwei Phasen pro Run:
//   1. Cron-Triggers detektieren (checkout, anniversary, seasonal) und in
//      marketing_drip_state enqueuen
//   2. Step-Sender iteriert alle nicht-completeten States, sendet fällige
//      Steps (delay_days seit triggered_at erreicht)
//
// Inline-Triggers (wallet_add, first_visit, visit_count_milestone) laufen NICHT
// hier — die feuern direkt im Code-Pfad der das Event erzeugt
// (/api/g/wallet/create.ts).
//
// PER_RUN_LIMIT=100 Steps/Tick als Runaway-Backstop.

import type { APIRoute } from 'astro';
import { getEnv } from '@retaha/db';
import { runCronTriggers, runDripStepSender } from '@retaha/marketing';

const STEP_SENDER_LIMIT = 100;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/marketing-drips] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (getEnv('MARKETING_ENABLED') !== 'true') {
    console.info('[cron/marketing-drips] disabled via MARKETING_ENABLED');
    return json({ ok: true, skipped: true, reason: 'MARKETING_ENABLED != true' }, 200);
  }

  const startedAt = Date.now();

  // Phase 1: Cron-Triggers
  const trig = await runCronTriggers();

  // Phase 2: Step-Sender (alles aktuell Fällige, frisch enqueueed Triggers
  // mit delay_days=0 werden hier auch gleich abgearbeitet)
  const send = await runDripStepSender(STEP_SENDER_LIMIT);

  const elapsed = Date.now() - startedAt;
  console.info(
    `[cron/marketing-drips] done · ` +
    `triggers={enqueued:${trig.totalEnqueued}, types:${trig.byType.length}} · ` +
    `sender={found:${send.found}, sent:${send.sent}, failed:${send.failed}} · ${elapsed}ms`,
  );

  return json({
    ok: true,
    triggers: trig,
    sender: send,
    elapsed_ms: elapsed,
  });
};
