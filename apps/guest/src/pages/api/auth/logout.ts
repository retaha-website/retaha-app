import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const client = createSupabaseServerInstance(cookies, request);
  await client.auth.signOut();
  const authUrl = import.meta.env.AUTH_APP_URL ?? 'https://auth.retaha.de';
  return redirect(`${authUrl}/login`);
};
