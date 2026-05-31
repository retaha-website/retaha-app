// Sprint Legal/DSGVO Phase 7 — Daten-Lösch-Self-Service (Art. 17 DSGVO)
//
// POST /api/g/data-deletion
// Auth: Stay-Session-Cookie (retaha_stay HS256 JWT). Kein Token in URL.
// Body: { scope: 'conversations' | 'app_data', confirm_text: 'LÖSCHEN' }
//
// Lösch-Scopes:
//   conversations → chat_messages + eve_action_log dieses Stays
//   app_data      → conversations + bookings + non-current consent_log
//
// NICHT löschbar:
//   - stays (Mews-Source-of-Truth, würde re-syncen)
//   - guests (vom Hotel verwaltet)
//   - hotel_settings, hotels (Hotel-Stammdaten)
//
// Audit-First-Pattern:
//   1. Counts vor Delete fetchen
//   2. deletion_log-Eintrag mit { status: 'pending', planned: {...} }
//   3. Sequenziell deleten
//   4. deletion_log mit actual results + status='completed' updaten
//   5. Bei Failure: status='failed' + error-message
//
// Rate-Limit: max 1 Lösch-Aktion pro 10 Minuten (destruktiver als Export).
//
// Session-Invalidierung: nach erfolgreicher Löschung wird der Stay-Session-
// Cookie gelöscht — sonst hätte der Gast eine "ghost session" mit leeren
// Daten. Frontend redirected zur Datenschutz-Page mit Success-Banner.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getStaySession, clearStaySessionCookie } from '../../../lib/auth/stay-session';
import { hashIp, extractClientIp } from '../../../lib/legal/consent';

const RATE_LIMIT_MINUTES = 10;
const VALID_SCOPES = ['conversations', 'app_data'] as const;
type Scope = typeof VALID_SCOPES[number];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { scope?: string; confirm_text?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const scope = body.scope as Scope;
  if (!VALID_SCOPES.includes(scope)) return json({ ok: false, error: 'invalid_scope' }, 400);
  if (body.confirm_text !== 'LÖSCHEN') return json({ ok: false, error: 'confirmation_required', message: 'Bitte tippe "LÖSCHEN" zur Bestätigung.' }, 400);

  const sb = createSupabaseServiceRoleInstance();

  // ── Rate-Limit ────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('deletion_log')
    .select('id')
    .eq('hotel_id', session.hotel_id)
    .eq('subject_type', 'guest_request')
    .filter('records_deleted->>stay_id', 'eq', session.stay_id)
    .gte('created_at', cutoff)
    .limit(1).maybeSingle();
  if (recent) {
    return json({ ok: false, error: 'rate_limited',
      message: `Bitte warte ${RATE_LIMIT_MINUTES} Minuten zwischen Lösch-Aktionen.` }, 429);
  }

  // ── Counts vor Delete (für Audit + UI-Response) ───────────────
  const counts: Record<string, number> = {};
  const tablesForScope: string[] = scope === 'conversations'
    ? ['chat_messages', 'eve_action_log']
    : ['chat_messages', 'eve_action_log', 'bookings', 'consent_log'];

  for (const table of tablesForScope) {
    if (table === 'eve_action_log') {
      const { count } = await sb.from(table)
        .select('id', { count: 'exact', head: true })
        .filter('result_data->>stay_id', 'eq', session.stay_id);
      counts[table] = count ?? 0;
    } else if (table === 'consent_log') {
      // Nicht-current consent_log löschen (aktueller Consent bleibt — DSGVO-Nachweispflicht)
      const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await sb.from(table)
        .select('id', { count: 'exact', head: true })
        .eq('stay_id', session.stay_id)
        .lt('created_at', lastWeek);
      counts[table] = count ?? 0;
    } else {
      const { count } = await sb.from(table)
        .select('id', { count: 'exact', head: true })
        .eq('stay_id', session.stay_id);
      counts[table] = count ?? 0;
    }
  }

  // ── Audit-First: deletion_log-Eintrag VOR Delete ──────────────
  const ipHash = hashIp(extractClientIp(request));
  const { data: auditRow, error: auditErr } = await sb.from('deletion_log').insert({
    hotel_id: session.hotel_id,
    subject_type: 'guest_request',
    subject_ref: hashIp(session.stay_id), // anonymisierter Stay-Ref via Hash
    deletion_reason: `Self-Service: scope=${scope}`,
    records_deleted: {
      stay_id: session.stay_id,
      scope,
      status: 'pending',
      planned: counts,
      ip_hash: ipHash,
    },
    triggered_by: 'gast',
  }).select('id').single();
  if (auditErr || !auditRow) {
    return json({ ok: false, error: 'audit_failed', detail: auditErr?.message }, 500);
  }

  // ── Sequenzielle Deletes ──────────────────────────────────────
  const actual: Record<string, number> = {};
  const errors: string[] = [];

  async function deleteTable(table: string, fn: () => Promise<{ data: any[] | null; error: any }>) {
    const { data: rows, error } = await fn();
    if (error) {
      errors.push(`${table}: ${error.message}`);
      actual[table] = 0;
    } else {
      actual[table] = rows?.length ?? 0;
    }
  }

  await deleteTable('chat_messages', () =>
    sb.from('chat_messages').delete().eq('stay_id', session.stay_id).select('id'));
  await deleteTable('eve_action_log', () =>
    sb.from('eve_action_log').delete().filter('result_data->>stay_id', 'eq', session.stay_id).select('id'));

  if (scope === 'app_data') {
    await deleteTable('bookings', () =>
      sb.from('bookings').delete().eq('stay_id', session.stay_id).select('id'));
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    await deleteTable('consent_log', () =>
      sb.from('consent_log').delete().eq('stay_id', session.stay_id).lt('created_at', lastWeek).select('id'));
  }

  // ── Audit-Update: status + actual counts ──────────────────────
  await sb.from('deletion_log').update({
    records_deleted: {
      stay_id: session.stay_id,
      scope,
      status: errors.length > 0 ? 'failed' : 'completed',
      planned: counts,
      actual,
      ...(errors.length > 0 ? { errors } : {}),
    },
  }).eq('id', auditRow.id);

  if (errors.length > 0) {
    return json({ ok: false, error: 'partial_failure', errors, deleted: actual }, 500);
  }

  // ── Session-Invalidierung (Ghost-Session vermeiden) ──────────
  clearStaySessionCookie(cookies);

  return json({
    ok: true,
    scope,
    deleted: actual,
    redirect_to: `/g/datenschutz-geloescht`,  // Erfolg-Page ohne Stay-Bezug
  });
};
