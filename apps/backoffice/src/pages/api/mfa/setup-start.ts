/**
 * POST /api/mfa/setup-start
 *
 * Wizard-Step 1->2: Generiert neues TOTP-Secret + QR-Code.
 * Speichert verschluesseltes Secret in user_mfa (enabled=false bis verify-success).
 *
 * Body: keiner.
 * Response: { ok, otpauth_url, qr_data_url, secret_for_manual_entry }
 *
 * IDEMPOTENT: bei wiederholtem Call wird existing Secret ueberschrieben
 * (User kann Wizard mehrfach starten). NICHT idempotent bei enabled=true —
 * dann muss User erst disable + neu starten.
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  generateSecret,
  buildOtpAuthUrl,
  generateQrCodeDataUrl,
  encryptSecret,
  logMfaEvent,
  parseUaFamily,
  parseDevice,
} from '@retaha/auth/mfa';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = userRes.user;
  const userEmail = user.email ?? `user-${user.id.slice(0, 8)}@retaha.de`;

  const service = createSupabaseServiceRoleInstance();

  // Pruefe ob schon enabled — wenn ja, blockieren (User muss erst disable)
  const { data: existing } = await service
    .from('user_mfa')
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.enabled) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'already_enabled',
        message: '2FA ist bereits aktiv. Bitte zuerst deaktivieren um neu einzurichten.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Generate fresh secret + encrypt + store
  const secret = generateSecret();
  const encrypted = encryptSecret(secret);

  const { error: upsertErr } = await service
    .from('user_mfa')
    .upsert({
      user_id: user.id,
      secret_encrypted: encrypted,
      enabled: false,
      verified_at: null,
      updated_at: new Date().toISOString(),
    });

  if (upsertErr) {
    console.error('[mfa-setup-start] upsert error:', upsertErr);
    return new Response(JSON.stringify({ ok: false, error: 'server-error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const otpauthUrl = buildOtpAuthUrl(secret, userEmail);
  const qrDataUrl = await generateQrCodeDataUrl(otpauthUrl);

  const ua = request.headers.get('user-agent');
  await logMfaEvent(service, {
    userId: user.id,
    eventType: 'setup_started',
    metadata: { ua_family: parseUaFamily(ua), device: parseDevice(ua) },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      otpauth_url: otpauthUrl,
      qr_data_url: qrDataUrl,
      // Klartext-Secret NUR fuer manuelle Eingabe (User scannt QR oder tippt manuell).
      // Wird beim Setup-Wizard angezeigt aber nicht im Browser-Storage persistiert.
      secret_for_manual_entry: secret,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
