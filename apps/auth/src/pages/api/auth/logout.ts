/**
 * POST/GET /api/auth/logout
 *
 * Löscht Cross-Subdomain Session-Cookie. Optional Supabase signOut für sauberen
 * Server-Side-State.
 *
 * GET ist erlaubt weil idempotent (Cookie-Delete). POST für CSRF-strikte Aufrufe.
 */

import type { APIRoute } from 'astro';
import { clearSessionCookie } from '@retaha/auth';
import { clearMfaMarkerCookie } from '@retaha/auth/mfa';

const handler: APIRoute = async ({ cookies }) => {
  clearSessionCookie(cookies);
  clearMfaMarkerCookie(cookies);
  return new Response(null, {
    status: 302,
    headers: { Location: '/logout' },
  });
};

export const GET = handler;
export const POST = handler;
