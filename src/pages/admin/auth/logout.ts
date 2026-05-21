import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const client = createSupabaseServerInstance(cookies, request);
  await client.auth.signOut();
  return redirect('/admin/login');
};
