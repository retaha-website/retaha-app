import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies, request, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/admin/dashboard';

  if (!code) {
    return redirect('/admin/login?error=no_code');
  }

  const client = createSupabaseServerInstance(cookies, request);
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    return redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  return redirect(next);
};
