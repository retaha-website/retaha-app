/**
 * POST /api/mfa/verify
 *
 * 2FA-Code-Verifizierung im Login-Flow.
 *
 * Body (JSON oder form):
 *   - code: 6 Ziffern
 *   - return_to: optional (whitelisted)
 *
 * Flow:
 *   1. Authenticated-Check (Supabase-Session-Cookie)
 *   2. Rate-Limit: 5 Versuche pro 30s pro User
 *   3. Lese user_mfa.secret_encrypted -> decrypt -> verifyToken
 *   4. on Success: Cookie mfa_verified=true (12h), Audit-Log + Redirect
 *   5. on Fail: Audit-Log code_failed + JSON-Error / Redirect mit ?error=
 *
 * SECURITY:
 *   - User muss eingeloggt sein (sonst 401)
 *   - Generic error "Code ungueltig" — kein Hinweis ob Secret existiert
 *   - mfa_verified cookie: httponly + secure + samesite=lax + 12h
 */

import type { APIRoute } from 'astro';
import {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  getSessionToken,
  getSessionTimeoutHours,
  decodeJwtExp,
  resolveMarkerTtl,
} from '@retaha/auth';
import {
  decryptSecret,
  verifyToken,
  logMfaEvent,
  parseUaFamily,
  parseDevice,
  setMfaMarkerCookie,
} from '@retaha/auth/mfa';
import { sanitizeReturnTo } from '../../../lib/redirect-whitelist';
import { rateLimit } from '../../../lib/rate-limit';

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

  if (!/^\d{6}$/.test(code)) {
    return bad(isJson, 'invalid-code', 'code muss 6 ziffern sein');
  }

  // 1. Auth-Check
  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(null, { status: 401, statusText: 'unauthorized' });
  }
  const user = userRes.user;

  // 2. Rate-Limit (5 / 30s per user)
  const limit = rateLimit(`mfa-verify:${user.id}`, { max: 5, windowMs: 30 * 1000 });
  if (!limit.allowed) {
    return bad(isJson, 'rate-limited', 'zu viele versuche, 30s warten');
  }

  // 3. Lese MFA-Config + Verify
  const service = createSupabaseServiceRoleInstance();
  const { data: mfa, error: mfaErr } = await service
    .from('user_mfa')
    .select('secret_encrypted, enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (mfaErr || !mfa || !mfa.enabled) {
    // User hat MFA gar nicht eingerichtet -> kein Audit-Log noetig
    return bad(isJson, 'mfa-not-enabled', 'mfa nicht aktiv');
  }

  let secret: string;
  try {
    secret = decryptSecret(mfa.secret_encrypted);
  } catch (e) {
    console.error('[mfa-verify] decrypt failed:', e);
    return bad(isJson, 'server-error', 'server-fehler');
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
      metadata,
    });
    return bad(isJson, 'invalid-code', 'code ungueltig. bitte erneut versuchen.');
  }

  // 4. Success: signierten, cross-subdomain MFA-Session-Marker setzen + Audit.
  // TTL = min(12h, session_timeout_hours, Session-Rest) — überlebt die Session nie.
  const timeoutHours = await getSessionTimeoutHours(service, user.id);
  const markerTtl = resolveMarkerTtl(timeoutHours, decodeJwtExp(getSessionToken(cookies)));
  setMfaMarkerCookie(cookies, user.id, markerTtl);

  await logMfaEvent(service, {
    userId: user.id,
    eventType: 'code_verified',
    metadata,
  });

  const safeReturnTo = sanitizeReturnTo(returnTo);

  if (isJson) {
    return new Response(JSON.stringify({ ok: true, redirect: safeReturnTo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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
    headers: { Location: `/mfa?error=${encodeURIComponent(message)}` },
  });
}
