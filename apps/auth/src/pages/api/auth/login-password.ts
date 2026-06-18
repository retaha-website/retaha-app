/**
 * POST /api/auth/login-password
 *
 * Sekundaerer Login-Pfad: Email + Passwort statt Magic-Link.
 * Workaround fuer Magic-Link-Email-Probleme / Rate-Limits.
 *
 * Body (form-encoded oder JSON):
 *   - email:     required
 *   - password:  required (min 8 chars)
 *   - return_to: optional (whitelisted via sanitizeReturnTo)
 *
 * Flow:
 *   1. Validate inputs + rate-limit per email
 *   2. Supabase signInWithPassword({ email, password })
 *   3. setSessionCookie(cookies, session.access_token)
 *   4. JSON-Antwort: { ok: true, redirect: safeReturnTo }
 *      (form-Antwort: 302 zu return_to)
 *
 * SECURITY:
 *   - Generic error messages (kein User-Enumeration)
 *   - Rate-Limit 5 Requests / Stunde pro Email
 *   - HTTPS-only Cookie via setSessionCookie
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { resolveLanding } from '../../../lib/landing';
import { finalizeLoginSession } from '../../../lib/mfa-gate';
import { rateLimit } from '../../../lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  let email = '';
  let password = '';
  let returnTo = '';
  let isJson = false;

  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      isJson = true;
      const j = await request.json();
      email = (j.email ?? '').toString().trim().toLowerCase();
      password = (j.password ?? '').toString();
      returnTo = (j.return_to ?? '').toString();
    } else {
      const fd = await request.formData();
      email = String(fd.get('email') ?? '').trim().toLowerCase();
      password = String(fd.get('password') ?? '');
      returnTo = String(fd.get('return_to') ?? '');
    }
  } catch {
    return badResponse(isJson, 'invalid-body', `/login?error=${encodeURIComponent('ungueltige eingabe')}`);
  }

  if (!EMAIL_RE.test(email)) {
    return badResponse(isJson, 'invalid-email', `/login?error=${encodeURIComponent('bitte eine gueltige email eingeben')}`);
  }

  if (!password || password.length < 8) {
    return badResponse(isJson, 'invalid-password', `/login?error=${encodeURIComponent('passwort muss mindestens 8 zeichen haben')}`);
  }

  const limit = rateLimit(`password-login:${email}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return badResponse(
      isJson,
      'rate-limited',
      `/login?error=${encodeURIComponent('zu viele anfragen. versuche es in einer stunde erneut')}`,
    );
  }

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[login-password] missing supabase env');
    return badResponse(isJson, 'server-config', `/login?error=${encodeURIComponent('server-konfiguration fehlt')}`);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    console.warn('[login-password] supabase error:', error?.message);
    return badResponse(
      isJson,
      'invalid-credentials',
      `/login?error=${encodeURIComponent('email oder passwort falsch')}`,
    );
  }

  // Session-Cookie (Timeout-bewusst) + MFA-Marker. Passwort-Login (kein Magic-Link):
  // bei aktivem MFA KEIN Marker → der Flächen-Gate wirft auf /mfa (Challenge).
  await finalizeLoginSession(cookies, data.session.access_token, data.user.id, false);

  // RBAC-Landing: owner/manager → Backoffice, staff → Dashboard.
  const landing = await resolveLanding(data.session.access_token, returnTo);

  if (isJson) {
    return new Response(JSON.stringify({ ok: true, redirect: landing }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: landing },
  });
};

function badResponse(isJson: boolean, code: string, redirectTo: string): Response {
  if (isJson) {
    return new Response(JSON.stringify({ ok: false, error: code }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 302, headers: { Location: redirectTo } });
}
