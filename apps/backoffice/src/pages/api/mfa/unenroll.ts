/**
 * POST /api/mfa/unenroll
 *
 * Deaktiviert 2FA für den eingeloggten User. Sicherheitskritisch → Re-Auth:
 * der User muss einen GÜLTIGEN aktuellen TOTP-Code mitschicken (verifyToken).
 *
 * Policy-Guard: Wenn das Hotel `mfa_required_for_team` = true hat, ist Deaktivieren
 * gesperrt (HTTP 403). Nicht still in Non-Compliance laufen lassen — wir blocken
 * mit Hinweis statt es zuzulassen.
 *
 * Body: { code: 6 Ziffern }
 * Erfolg:  { ok: true }
 * Fehler:  { ok: false, error, message }
 *
 * Bei Erfolg: user_mfa.enabled=false, verified_at=null, secret_encrypted=null +
 * alle Recovery-Codes gelöscht + 'disabled'-Audit-Event.
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  decryptSecret,
  verifyToken,
  logMfaEvent,
  parseUaFamily,
  parseDevice,
  getHotelMfaPolicy,
  clearMfaMarkerCookie,
} from '@retaha/auth/mfa';

export const POST: APIRoute = async ({ request, cookies }) => {
  let code = '';
  try {
    const body = await request.json();
    code = (body.code ?? '').toString().trim();
  } catch {
    return bad('invalid-body', 'Ungültige Eingabe.');
  }

  if (!/^\d{6}$/.test(code)) {
    return bad('invalid-code', 'Code muss 6 Ziffern sein.');
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

  // Policy-Guard: Hotel-Pflicht → Deaktivieren gesperrt.
  const { data: hu } = await service
    .from('hotel_users')
    .select('hotel_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (hu?.hotel_id) {
    const policy = await getHotelMfaPolicy(service, hu.hotel_id);
    if (policy?.required) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'policy-required',
          message: '2FA ist für dein Team verpflichtend und kann nicht deaktiviert werden.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Re-Auth: aktuellen TOTP-Code prüfen.
  const { data: mfa, error: mfaErr } = await service
    .from('user_mfa')
    .select('secret_encrypted, enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (mfaErr || !mfa || !mfa.enabled) {
    return bad('not-enabled', '2FA ist nicht aktiv.');
  }

  let secret: string;
  try {
    secret = decryptSecret(mfa.secret_encrypted);
  } catch (e) {
    console.error('[mfa-unenroll] decrypt failed:', e);
    return bad('server-error', 'Server-Fehler.');
  }

  const ua = request.headers.get('user-agent');
  const metadata = { ua_family: parseUaFamily(ua), device: parseDevice(ua) };

  if (!verifyToken(code, secret)) {
    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'code_failed',
      metadata: { ...metadata, context: { during: 'disable' } },
    });
    return bad('invalid-code', 'Code ungültig. Bitte erneut versuchen.');
  }

  // Disable: Recovery-Codes löschen + user_mfa zurücksetzen.
  await service.from('user_mfa_recovery_codes').delete().eq('user_id', user.id);

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await service
    .from('user_mfa')
    .update({
      enabled: false,
      verified_at: null,
      secret_encrypted: null,
      updated_at: nowIso,
    })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[mfa-unenroll] update error:', updateErr);
    return bad('server-error', '2FA konnte nicht deaktiviert werden.');
  }

  // MFA-Session-Marker invalidieren (konsistent zum Disable).
  clearMfaMarkerCookie(cookies);

  await logMfaEvent(service, {
    userId: user.id,
    eventType: 'disabled',
    metadata: { ...metadata, context: { via: 'profil' } },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

function bad(code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
