/**
 * POST /api/mfa/setup-verify
 *
 * Wizard-Step 3: Verifiziert ersten Code aus Authenticator-App.
 * Bei Erfolg: enabled=true, verified_at=now, 8 Recovery-Codes generieren + speichern.
 *
 * Body: { code: 6 Ziffern }
 * Response on Success: { ok, recovery_codes: string[] } — KLARTEXT, einmalig
 * Response on Fail: { ok: false, error, message }
 *
 * Recovery-Codes werden NUR in dieser Response geliefert — User MUSS sie speichern.
 * Nach Confirm-Step kann er sie nie wieder klartextlich sehen.
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  decryptSecret,
  verifyToken,
  generateRecoveryCodes,
  hashAllCodes,
  logMfaEvent,
  parseUaFamily,
  parseDevice,
  CODES_PER_USER,
} from '@retaha/auth/mfa';

export const POST: APIRoute = async ({ request, cookies }) => {
  let code = '';
  try {
    const body = await request.json();
    code = (body.code ?? '').toString().trim();
  } catch {
    return bad('invalid-body', 'ungueltige eingabe');
  }

  if (!/^\d{6}$/.test(code)) {
    return bad('invalid-code', 'code muss 6 ziffern sein');
  }

  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = userRes.user;

  const service = createSupabaseServiceRoleInstance();
  const { data: mfa, error: mfaErr } = await service
    .from('user_mfa')
    .select('secret_encrypted, enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (mfaErr || !mfa) {
    return bad('setup-not-started', 'setup wurde noch nicht gestartet');
  }
  if (mfa.enabled) {
    return bad('already-enabled', '2fa ist bereits aktiv');
  }

  let secret: string;
  try {
    secret = decryptSecret(mfa.secret_encrypted);
  } catch (e) {
    console.error('[mfa-setup-verify] decrypt failed:', e);
    return bad('server-error', 'server-fehler');
  }

  const valid = verifyToken(code, secret);

  const ua = request.headers.get('user-agent');
  const metadata = {
    ua_family: parseUaFamily(ua),
    device: parseDevice(ua),
  };

  if (!valid) {
    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'code_failed',
      metadata: { ...metadata, context: { during: 'setup' } },
    });
    return bad('invalid-code', 'code ungueltig. bitte erneut versuchen.');
  }

  // Generate + Hash + Insert Recovery-Codes (8 stueck)
  const codes = generateRecoveryCodes();
  const hashes = await hashAllCodes(codes);

  // Existing codes loeschen (falls Wizard wiederholt) + neue inserten
  await service.from('user_mfa_recovery_codes').delete().eq('user_id', user.id);

  const inserts = hashes.map((code_hash) => ({ user_id: user.id, code_hash }));
  const { error: insertErr } = await service
    .from('user_mfa_recovery_codes')
    .insert(inserts);

  if (insertErr) {
    console.error('[mfa-setup-verify] recovery insert error:', insertErr);
    return bad('server-error', 'recovery-codes konnten nicht gespeichert werden');
  }

  // Enable MFA
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await service
    .from('user_mfa')
    .update({
      enabled: true,
      verified_at: nowIso,
      updated_at: nowIso,
    })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[mfa-setup-verify] update error:', updateErr);
    return bad('server-error', 'mfa konnte nicht aktiviert werden');
  }

  await logMfaEvent(service, {
    userId: user.id,
    eventType: 'setup_completed',
    metadata: { ...metadata, context: { recovery_codes_count: CODES_PER_USER } },
  });

  return new Response(
    JSON.stringify({ ok: true, recovery_codes: codes }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

function bad(code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
