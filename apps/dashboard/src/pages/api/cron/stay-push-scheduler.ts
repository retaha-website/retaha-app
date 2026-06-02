// Sprint Wallet · Modul D — Stay-Push-Scheduler-Cron
//
// Schedule: alle 15 Min (analog marketing-scheduler)
// Auth: Bearer ${CRON_SECRET}
// Kill-Switch: STAY_PUSH_ENABLED='true'
//
// Aktuell nur checkout_reminder:
//   Findet stays mit check_out in [NOW+50min, NOW+70min] UND state IN ('active','arrived')
//   UND noch kein stay_push_sends mit trigger_type='checkout_reminder' für diesen Stay.
//   Idempotenz wird durch sendStayPush selbst gehandhabt (UNIQUE-Index).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { sendStayPush } from '@retaha/wallet';

const PER_RUN_LIMIT = 200;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) return json({ ok: false, error: 'Unauthorized' }, 401);

  if (getEnv('STAY_PUSH_ENABLED') !== 'true') {
    console.info('[cron/stay-push-scheduler] disabled via STAY_PUSH_ENABLED');
    return json({ ok: true, skipped: true, reason: 'STAY_PUSH_ENABLED != true' });
  }

  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // Window: 50–70 Min vor check_out. Cron läuft alle 15 Min → 20-Min-Fenster reicht
  // damit kein Stay durchschlüpft (mit 5 Min Overlap am Rand).
  const now = Date.now();
  const winStart = new Date(now + 50 * 60_000).toISOString();
  const winEnd   = new Date(now + 70 * 60_000).toISOString();

  const { data: candidates, error } = await sb
    .from('stays')
    .select('id, hotel_id, check_out, state')
    .gte('check_out', winStart)
    .lte('check_out', winEnd)
    .in('state', ['active', 'arrived', 'Started'])
    .limit(PER_RUN_LIMIT);

  if (error) {
    console.error('[cron/stay-push-scheduler] load failed:', error.message);
    return json({ ok: false, error: error.message }, 500);
  }
  if (!candidates || candidates.length === 0) {
    return json({ ok: true, processed: 0, sent: 0, skipped: 0 });
  }

  let sent = 0, skipped = 0, failed = 0;
  const reasons: Record<string, number> = {};

  for (const stay of candidates) {
    try {
      const r = await sendStayPush(stay.id, 'checkout_reminder');
      if (r.ok && r.status === 'sent') sent++;
      else if (r.status === 'skipped_already_sent') skipped++;
      else if (r.status === 'error') failed++;
      else skipped++;
      const k = r.status;
      reasons[k] = (reasons[k] || 0) + 1;
    } catch (err) {
      failed++;
      console.warn(`[cron/stay-push-scheduler] stay ${stay.id.slice(0,8)} crashed:`, (err as Error).message);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.info(
    `[cron/stay-push-scheduler] done · candidates=${candidates.length} sent=${sent} ` +
    `skipped=${skipped} failed=${failed} · ${elapsed}ms · reasons=${JSON.stringify(reasons)}`,
  );

  return json({ ok: true, processed: candidates.length, sent, skipped, failed, reasons, elapsed_ms: elapsed });
};
