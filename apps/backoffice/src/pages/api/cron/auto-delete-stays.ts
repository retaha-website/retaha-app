// Sprint Legal/DSGVO Phase 8 — Auto-Delete bei Checkout
//
// Vercel-Cron-Schedule (vercel.json): "0 2 * * *" — täglich 02:00 UTC,
// vor places-refresh und mews-sync.
//
// Findet ausgecheckte Stays älter als RETENTION_DAYS und löscht ihre
// App-spezifischen Daten (analog Phase-7-Self-Service "app_data"-Scope):
//   - chat_messages (sensibel, zuerst)
//   - eve_action_log
//   - bookings
//   - alte consent_log (>7 Tage; aktueller Consent bleibt)
//
// NICHT gelöscht:
//   - stays / guests / hotels (Mews-Source-of-Truth bleibt)
//
// Audit-First-Pattern (analog Phase 7):
//   1. Counts vor Delete
//   2. deletion_log mit { status: 'pending', planned }
//   3. Sequenzielle Deletes
//   4. deletion_log mit { status: 'completed' | 'failed' }
//
// Wiederkehrer-Personalisierung kommt via Wallet-Mechanismus (Sprint E5),
// nicht via Stay-Datenhaltung. Auto-Delete bleibt strict für DSGVO.
//
// Auth: Bearer ${CRON_SECRET} + AUTO_DELETE_ENABLED='true' Kill-Switch.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';

const RETENTION_DAYS = 30;  // global, später ggf. pro Hotel konfigurierbar (Backlog)
const CONSENT_KEEP_RECENT_DAYS = 7;  // konsistent zu Phase 7

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/auto-delete-stays] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  // Kill-Switch — explizit aktivieren in ENV (sicher gegen versehentliche Erst-Ausführung)
  if (getEnv('AUTO_DELETE_ENABLED') !== 'true') {
    console.info('[cron/auto-delete-stays] disabled via AUTO_DELETE_ENABLED');
    return json({ ok: true, skipped: true, reason: 'AUTO_DELETE_ENABLED != true' }, 200);
  }

  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // ── Qualifying Stays finden ───────────────────────────────────
  // check_out < NOW() - 30 Tage UND nicht mehr 'Started' (Sicherheits-Filter
  // falls Mews den State noch nicht aktualisiert hat).
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data: qualifying, error: loadErr } = await sb
    .from('stays')
    .select('id, hotel_id, check_out, state')
    .lt('check_out', cutoff)
    .neq('state', 'Started');

  if (loadErr) {
    console.error('[cron/auto-delete-stays] load failed:', loadErr);
    return json({ ok: false, error: loadErr.message }, 500);
  }

  const stays = qualifying ?? [];
  console.info(`[cron/auto-delete-stays] ${stays.length} stays qualify for auto-delete (cutoff: ${cutoff})`);

  let succeeded = 0, failed = 0;
  const totalRecords = { chat_messages: 0, eve_action_log: 0, bookings: 0, consent_log: 0 };
  const consentCutoff = new Date(Date.now() - CONSENT_KEEP_RECENT_DAYS * 86_400_000).toISOString();

  // ── Pro-Stay-Pipeline (try/catch isoliert Failures) ──────────
  for (const stay of stays) {
    try {
      // Counts vor Delete
      const counts: Record<string, number> = {};
      const [m, a, b, c] = await Promise.all([
        sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('stay_id', stay.id),
        sb.from('eve_action_log').select('id', { count: 'exact', head: true }).filter('result_data->>stay_id', 'eq', stay.id),
        sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', stay.id),
        sb.from('consent_log').select('id', { count: 'exact', head: true }).eq('stay_id', stay.id).lt('created_at', consentCutoff),
      ]);
      counts.chat_messages = m.count ?? 0;
      counts.eve_action_log = a.count ?? 0;
      counts.bookings = b.count ?? 0;
      counts.consent_log = c.count ?? 0;

      // Skip wenn nichts zu löschen
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      if (total === 0) {
        continue;
      }

      // Audit-First
      const { data: auditRow, error: auditErr } = await sb.from('deletion_log').insert({
        hotel_id: stay.hotel_id,
        subject_type: 'auto_checkout',
        deletion_reason: `Cron: check_out=${stay.check_out}, retention=${RETENTION_DAYS}d`,
        records_deleted: {
          stay_id: stay.id,
          check_out: stay.check_out,
          status: 'pending',
          planned: counts,
        },
        triggered_by: 'cron',
      }).select('id').single();
      if (auditErr || !auditRow) throw new Error(`audit insert failed: ${auditErr?.message}`);

      // Sequenzielle Deletes
      const actual: Record<string, number> = {};
      const errors: string[] = [];

      async function doDelete(label: string, fn: () => Promise<{ data: any[] | null; error: any }>) {
        const { data, error } = await fn();
        if (error) { errors.push(`${label}: ${error.message}`); actual[label] = 0; }
        else { actual[label] = data?.length ?? 0; }
      }

      await doDelete('chat_messages', () =>
        sb.from('chat_messages').delete().eq('stay_id', stay.id).select('id'));
      await doDelete('eve_action_log', () =>
        sb.from('eve_action_log').delete().filter('result_data->>stay_id', 'eq', stay.id).select('id'));
      await doDelete('bookings', () =>
        sb.from('bookings').delete().eq('stay_id', stay.id).select('id'));
      await doDelete('consent_log', () =>
        sb.from('consent_log').delete().eq('stay_id', stay.id).lt('created_at', consentCutoff).select('id'));

      // Audit-Update
      await sb.from('deletion_log').update({
        records_deleted: {
          stay_id: stay.id,
          check_out: stay.check_out,
          status: errors.length > 0 ? 'failed' : 'completed',
          planned: counts,
          actual,
          ...(errors.length > 0 ? { errors } : {}),
        },
      }).eq('id', auditRow.id);

      if (errors.length > 0) {
        failed++;
        console.warn(`[cron/auto-delete-stays] stay ${stay.id.slice(0,8)} partial-fail: ${errors.join(' | ')}`);
      } else {
        succeeded++;
        for (const k of Object.keys(actual)) totalRecords[k as keyof typeof totalRecords] += actual[k];
      }
    } catch (err) {
      failed++;
      console.error(`[cron/auto-delete-stays] stay ${stay.id.slice(0,8)} crashed:`, err);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.info(
    `[cron/auto-delete-stays] done · processed=${stays.length} succeeded=${succeeded} failed=${failed} ` +
    `records=${JSON.stringify(totalRecords)} · ${elapsed}ms`
  );

  return json({
    ok: true,
    processed: stays.length,
    succeeded,
    failed,
    total_records_deleted: totalRecords,
    elapsed_ms: elapsed,
    retention_days: RETENTION_DAYS,
  });
};
