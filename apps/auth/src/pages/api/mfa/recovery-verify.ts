/**
 * POST /api/mfa/recovery-verify
 *
 * Recovery-Code-Verifizierung (Notfall, wenn keine App verfuegbar).
 *
 * Body (JSON oder form):
 *   - code: 8 alphanumerische Zeichen (mit oder ohne Bindestrich)
 *   - return_to: optional (whitelisted)
 *
 * Flow:
 *   1. Authenticated-Check
 *   2. Rate-Limit: 5 Versuche pro 5min pro User (strenger als TOTP — Recovery sind teurer)
 *   3. Hole alle UNGENUTZTEN Recovery-Codes -> verifyCode loop -> Match?
 *   4. on Match: Code als used markieren (used_at=now()) + Cookie mfa_verified=true
 *   5. on Mismatch: Generic Error (keine Info ob Code existiert)
 *   6. Wenn nur 2 verbleibend nach Verbrauch -> low_recovery_warning Event + Email
 */

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  verifyCode,
  logMfaEvent,
  parseUaFamily,
  parseDevice,
} from '@retaha/auth/mfa';
import { sanitizeReturnTo } from '../../../lib/redirect-whitelist';
import { rateLimit } from '../../../lib/rate-limit';

const MFA_VERIFIED_COOKIE = 'mfa_verified';
const MFA_VERIFIED_TTL_SECONDS = 12 * 60 * 60;
const LOW_RECOVERY_THRESHOLD = 2;

export const POST: APIRoute = async ({ request, cookies }) => {
  let code = '';
  let returnTo = '';
  let isJson = false;

  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      isJson = true;
      const j = await request.json();
      code = (j.code ?? '').toString().trim();
      returnTo = (j.return_to ?? '').toString();
    } else {
      const fd = await request.formData();
      code = String(fd.get('code') ?? '').trim();
      returnTo = String(fd.get('return_to') ?? '');
    }
  } catch {
    return bad(isJson, 'invalid-body', 'ungueltige eingabe');
  }

  const normalized = code.toUpperCase().replace(/-/g, '');
  if (!/^[A-Z0-9]{8}$/.test(normalized)) {
    return bad(isJson, 'invalid-format', 'code-format ungueltig');
  }

  // 1. Auth
  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return new Response(null, { status: 401, statusText: 'unauthorized' });
  }
  const user = userRes.user;

  // 2. Rate-Limit (strenger als TOTP — Recovery-Codes sind sensitiver)
  const limit = rateLimit(`mfa-recovery:${user.id}`, { max: 5, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(isJson, 'rate-limited', 'zu viele versuche. 5 minuten warten.');
  }

  const service = createSupabaseServiceRoleInstance();
  const { data: codes, error: codesErr } = await service
    .from('user_mfa_recovery_codes')
    .select('id, code_hash')
    .eq('user_id', user.id)
    .is('used_at', null);

  if (codesErr) {
    console.error('[recovery-verify] db error:', codesErr);
    return bad(isJson, 'server-error', 'server-fehler');
  }

  const ua = request.headers.get('user-agent');
  const metadata = {
    ua_family: parseUaFamily(ua),
    device: parseDevice(ua),
  };

  if (!codes || codes.length === 0) {
    // Keine unused codes mehr -> auch fail (User muss zu Support)
    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'code_failed',
      metadata: { ...metadata, context: { reason: 'no_recovery_codes_left' } },
    });
    return bad(isJson, 'no-codes', 'keine recovery-codes verfuegbar. support kontaktieren.');
  }

  // 3. Verify gegen alle ungenutzten Codes
  let matchedId: string | null = null;
  for (const row of codes) {
    if (await verifyCode(normalized, row.code_hash)) {
      matchedId = row.id;
      break;
    }
  }

  if (!matchedId) {
    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'code_failed',
      metadata: { ...metadata, context: { type: 'recovery' } },
    });
    return bad(isJson, 'invalid-code', 'code ungueltig.');
  }

  // 4. Code als used markieren
  await service
    .from('user_mfa_recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', matchedId);

  // Cookie + Audit
  cookies.set(MFA_VERIFIED_COOKIE, 'true', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: MFA_VERIFIED_TTL_SECONDS,
  });

  await logMfaEvent(service, {
    userId: user.id,
    eventType: 'recovery_used',
    metadata,
  });

  // 5. Low-recovery-warning bei 2 oder weniger uebrig
  const remaining = codes.length - 1;
  if (remaining <= LOW_RECOVERY_THRESHOLD) {
    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'low_recovery_warning',
      metadata: { ...metadata, context: { remaining } },
    });
  }

  const safeReturnTo = sanitizeReturnTo(returnTo);

  if (isJson) {
    return new Response(
      JSON.stringify({ ok: true, redirect: safeReturnTo, remaining }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(null, {
    status: 302,
    headers: { Location: safeReturnTo },
  });
};

function bad(isJson: boolean, code: string, message: string): Response {
  if (isJson) {
    return new Response(JSON.stringify({ ok: false, error: code, message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `/mfa-recovery?error=${encodeURIComponent(message)}` },
  });
}
