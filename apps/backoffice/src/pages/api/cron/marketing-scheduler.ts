// Sprint Wallet · Phase 10 — Marketing-Scheduling-Cron
//
// Schedule: alle 15 Min (siehe vercel.json — "0,15,30,45 * * * *")
// Auth: Bearer ${CRON_SECRET}
// Kill-Switch: MARKETING_ENABLED='true' muss explizit gesetzt sein.
//
// Logik:
//   1. Findet status='scheduled' AND scheduled_at <= NOW (jüngste zuerst)
//   2. Limit pro Cron-Run: 5 Campaigns (defensiv gegen runaway-Loops)
//   3. Pro Campaign: runCampaignSend() — die atomare Lock-Logik dort
//      verhindert Doppel-Runs falls Cron sich überholt
//
// Failure-Isolation: try/catch pro Campaign. Crash einer killt nicht die anderen.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { runCampaignSend } from '@retaha/marketing';

const PER_RUN_LIMIT = 5;  // max Campaigns pro 15-Min-Tick

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/marketing-scheduler] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (getEnv('MARKETING_ENABLED') !== 'true') {
    console.info('[cron/marketing-scheduler] disabled via MARKETING_ENABLED');
    return json({ ok: true, skipped: true, reason: 'MARKETING_ENABLED != true' }, 200);
  }

  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // Due-Campaigns finden — älteste scheduled_at zuerst (FIFO)
  const { data: due, error } = await sb
    .from('marketing_campaigns')
    .select('id, name, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(PER_RUN_LIMIT);

  if (error) {
    console.error('[cron/marketing-scheduler] load failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  if (!due || due.length === 0) {
    return json({ ok: true, processed: 0, message: 'nothing_due' });
  }

  const results: any[] = [];
  let totalSent = 0, totalSkipped = 0, totalFailed = 0;
  let crashed = 0;

  for (const c of due) {
    try {
      const r = await runCampaignSend(c.id);
      results.push({ id: c.id, name: c.name, ...r });
      totalSent += r.recipients;
      totalSkipped += r.skipped;
      totalFailed += r.failed;
    } catch (err) {
      crashed++;
      console.error(`[cron/marketing-scheduler] campaign ${c.id.slice(0, 8)} crashed:`, (err as Error).message);
      results.push({ id: c.id, name: c.name, ok: false, error: (err as Error).message });
    }
  }

  const elapsed = Date.now() - startedAt;
  console.info(
    `[cron/marketing-scheduler] done · processed=${due.length} ` +
    `sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed} crashed=${crashed} · ${elapsed}ms`,
  );

  return json({
    ok: true,
    processed: due.length,
    total_sent: totalSent,
    total_skipped: totalSkipped,
    total_failed: totalFailed,
    crashed,
    elapsed_ms: elapsed,
    results,
  });
};
