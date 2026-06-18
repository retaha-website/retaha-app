/**
 * POST /api/auth/callback
 *
 * Body (JSON):
 *   - access_token:   required (Supabase Access-Token aus Implicit-Flow Hash)
 *   - refresh_token:  optional
 *   - return_to:      optional (URL die der User danach sehen soll)
 *
 * Flow:
 *   1. Verify access_token via Supabase getUser()
 *   2. Wenn valid → setSessionCookie cross-subdomain
 *   3. Return JSON { ok: true, redirect: safeReturnTo }
 *
 * Note: Wird vom Browser-Bootstrap-JS in /callback.astro aufgerufen,
 * weil Implicit-Flow Tokens im URL-Fragment sind und nicht server-seitig
 * lesbar. PKCE/?code= wird direkt in callback.astro verifiziert.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { resolveLanding } from '../../../lib/landing';
import { finalizeLoginSession } from '../../../lib/mfa-gate';

export const POST: APIRoute = async ({ request, cookies }) => {
  let accessToken = '';
  let returnTo = '';

  try {
    const j = await request.json();
    accessToken = (j.access_token ?? '').toString();
    returnTo = (j.return_to ?? '').toString();
  } catch {
    return json({ ok: false, error: 'invalid-body' }, 400);
  }

  if (!accessToken) {
    return json({ ok: false, error: 'missing-access-token' }, 400);
  }

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ ok: false, error: 'server-config' }, 500);
  }

  // Verify token by getUser — Supabase prüft Signatur + Expiry
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return json({ ok: false, error: error?.message ?? 'invalid-token' }, 401);
  }

  // Session-Cookie (Timeout-bewusst) + MFA-Marker. Magic-Link: Marker bei
  // non-MFA + require_on_magic_link=false; sonst Flächen-Gate → /mfa.
  await finalizeLoginSession(cookies, accessToken, data.user.id, true);

  // RBAC-Landing: owner/manager → Backoffice, staff → Dashboard.
  const landing = await resolveLanding(accessToken, returnTo);
  return json({ ok: true, redirect: landing }, 200);
};

function json(body: any, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
