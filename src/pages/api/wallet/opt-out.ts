// Sprint Wallet · Phase 7 — Opt-Out-Endpoint
//
// POST /api/wallet/opt-out
// Body: { token: string }
//
// Token kommt aus dem Opt-Out-Link in einem Marketing-Push. Wir verifyen
// das JWT (HS256 mit STAY_SESSION_SECRET, audience='wallet-opt-out'), setzen
// wallet_passes.state='opted_out' und schreiben einen marketing_consents-
// Audit-Eintrag mit action='revoked'.
//
// Idempotent: mehrfaches Opt-Out tut nichts Böses (nur ein Audit-Eintrag pro
// Aufruf — die Historie zeigt dann z.B. zwei revokes).

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';
import { verifyOptOutToken } from '../../../lib/wallet/opt-out-token';

const POLICY_VERSION = '2026-06-01';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = getEnv('STAY_SESSION_SECRET') || '';
  if (!salt) return null;
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);
}

function clientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body.token) return json({ ok: false, error: 'missing_token' }, 400);

  const payload = await verifyOptOutToken(body.token);
  if (!payload) return json({ ok: false, error: 'invalid_or_expired_token' }, 401);

  const sb = createSupabaseServiceRoleInstance();

  // Pass laden
  const { data: pass } = await sb
    .from('wallet_passes')
    .select('id, state, hotel_id')
    .eq('id', payload.wallet_pass_id)
    .maybeSingle();
  if (!pass) return json({ ok: false, error: 'pass_not_found' }, 404);

  // Wenn bereits opted_out: idempotent erfolgreich, KEIN neuer Audit-Eintrag
  // (würde sonst bei jedem Re-Click eine Zeile produzieren — die Historie
  // soll echte State-Changes zeigen, nicht Mehrfach-Klicks).
  if (pass.state === 'opted_out') {
    return json({ ok: true, already_opted_out: true });
  }

  const now = new Date().toISOString();
  const ipHash = hashIp(clientIp(request));
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;

  // 1. State-Update
  const { error: updateErr } = await sb.from('wallet_passes').update({
    state: 'opted_out',
    opted_out_at: now,
    opted_out_reason: 'user_unsubscribe',
    marketing_consent_given: false,
  }).eq('id', pass.id);
  if (updateErr) {
    console.error('[wallet/opt-out] state update failed:', updateErr);
    return json({ ok: false, error: updateErr.message }, 500);
  }

  // 2. Audit-Eintrag
  const { error: auditErr } = await sb.from('marketing_consents').insert({
    wallet_pass_id: pass.id,
    action: 'revoked',
    source: 'opt_out_link',
    ip_hash: ipHash,
    user_agent: userAgent,
    policy_version: POLICY_VERSION,
  });
  if (auditErr) {
    // State ist schon geändert — Audit-Fehler logged aber nicht propagiert
    console.warn('[wallet/opt-out] audit insert failed (non-fatal):', auditErr);
  }

  return json({ ok: true });
};
