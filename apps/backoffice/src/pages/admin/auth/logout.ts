import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, clearSessionCookie } from '@retaha/auth';
import { clearMfaMarkerCookie } from '@retaha/auth/mfa';

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const client = createSupabaseServerInstance(cookies, request);
  await client.auth.signOut();
  clearSessionCookie(cookies);
  clearMfaMarkerCookie(cookies);
  const authUrl = import.meta.env.AUTH_APP_URL ?? 'https://auth.retaha.de';
  return redirect(`${authUrl}/login`);
};
