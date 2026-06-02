/**
 * POST /api/auth/dev-login — Dev-Only Direct-Login.
 *
 * Generiert via Supabase Admin-API einen Magic-Link, verifiziert ihn sofort
 * server-seitig, setzt Cross-Subdomain-Session-Cookie. Kein Email-Versand.
 *
 * SICHERHEITS-HARD-BLOCKS:
 *   1. 404 in Production (NODE_ENV='production' oder import.meta.env.PROD)
 *   2. Email muss auf @retaha.de enden (Test-Domain)
 *   3. Nutzt Service-Role — daher nur als Whitelist-API-Route mit beiden
 *      Schichten Production-Protection.
 *
 * Body (JSON):
 *   - email:     required (@retaha.de Testaccount)
 *   - return_to: optional (whitelisted via sanitizeReturnTo)
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { setSessionCookie } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { sanitizeReturnTo } from '../../../lib/redirect-whitelist';

function isProduction(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) return true;
  return getEnv('NODE_ENV') === 'production';
}

function json(body: any, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  // ─── HARD-BLOCK 1: Production = 404 ──────────────────────
  if (isProduction()) {
    return new Response('Not Found', { status: 404 });
  }

  let email = '';
  let returnTo = '';
  try {
    const body = await request.json();
    email = (body.email ?? '').toString().trim().toLowerCase();
    returnTo = (body.return_to ?? '').toString();
  } catch {
    return json({ ok: false, error: 'invalid-body' }, 400);
  }

  // ─── HARD-BLOCK 2: nur @retaha.de Testaccounts ───────────
  if (!email.endsWith('@retaha.de')) {
    return json({ ok: false, error: 'only @retaha.de test emails allowed in dev-login' }, 400);
  }

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'server-config: missing supabase env' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate Magic-Link OHNE Email-Versand (admin.generateLink mit Email-Provider-Override)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return json({ ok: false, error: linkError?.message ?? 'failed-to-generate-link' }, 500);
  }

  // Token-Hash sofort server-seitig verifizieren → Session erzeugen
  const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError || !verifyData?.session?.access_token) {
    return json({ ok: false, error: verifyError?.message ?? 'failed-to-verify-token' }, 500);
  }

  // Cross-Subdomain-Cookie setzen
  setSessionCookie(cookies, verifyData.session.access_token);

  const safeReturnTo = sanitizeReturnTo(returnTo);
  return json({ ok: true, redirect: safeReturnTo, user: { email } }, 200);
};
