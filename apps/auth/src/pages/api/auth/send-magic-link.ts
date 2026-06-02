/**
 * POST /api/auth/send-magic-link
 *
 * Body (form-encoded oder JSON):
 *   - email:     required (Hotelier-Email)
 *   - return_to: optional (wird whitelisted)
 *
 * Flow:
 *   1. Validate email + rate-limit per email
 *   2. Supabase signInWithOtp({ email, emailRedirectTo: AUTH_APP_URL/callback?return_to=... })
 *   3. Supabase trigger Resend-Email mit Magic-Link
 *   4. Redirect zu /login?sent=1 (oder JSON wenn fetch)
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { sanitizeReturnTo } from '../../../lib/redirect-whitelist';
import { rateLimit } from '../../../lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  let email = '';
  let returnTo = '';
  let isJson = false;

  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      isJson = true;
      const j = await request.json();
      email = (j.email ?? '').toString().trim().toLowerCase();
      returnTo = (j.return_to ?? '').toString();
    } else {
      const fd = await request.formData();
      email = String(fd.get('email') ?? '').trim().toLowerCase();
      returnTo = String(fd.get('return_to') ?? '');
    }
  } catch {
    return badResponse(isJson, 'invalid-body', `/login?error=${encodeURIComponent('ungültige eingabe')}`);
  }

  if (!EMAIL_RE.test(email)) {
    return badResponse(isJson, 'invalid-email', `/login?error=${encodeURIComponent('bitte eine gültige email eingeben')}`);
  }

  // Rate-Limit pro Email (5 Requests / Stunde)
  const limit = rateLimit(`magic-link:${email}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return badResponse(
      isJson,
      'rate-limited',
      `/login?error=${encodeURIComponent('zu viele anfragen. versuche es in einer stunde erneut')}`,
    );
  }

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  const authAppUrl = getEnv('AUTH_APP_URL') ?? 'https://auth.retaha.de';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[send-magic-link] missing supabase env');
    return badResponse(isJson, 'server-config', `/login?error=${encodeURIComponent('server-konfiguration fehlt')}`);
  }

  const safeReturnTo = sanitizeReturnTo(returnTo);
  const emailRedirectTo = `${authAppUrl}/callback?return_to=${encodeURIComponent(safeReturnTo)}`;

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: false, // Hotelier muss vorher angelegt sein (via Team-Invite)
    },
  });

  if (error) {
    console.warn('[send-magic-link] supabase error:', error.message);
    // Don't leak whether email exists — generic message
    if (error.message.toLowerCase().includes('signup')) {
      return badResponse(
        isJson,
        'unknown-email',
        `/login?error=${encodeURIComponent('diese email ist nicht hinterlegt. frag deinen team-owner um eine einladung')}`,
      );
    }
    return badResponse(isJson, error.message, `/login?error=${encodeURIComponent('fehler beim senden. versuche es erneut')}`);
  }

  if (isJson) {
    return new Response(JSON.stringify({ ok: true, message: 'magic-link gesendet' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: '/login?sent=1' },
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
