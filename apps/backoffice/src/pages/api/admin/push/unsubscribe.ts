// Sprint Functional Modul D · Phase 10 — Hotelier-Push abbestellen
//
// POST /api/admin/push/unsubscribe
// Body: { endpoint }
// Auth: User-Session. Löscht NUR die eigene Subscription (RLS-Delete-Policy
// auf user_id = auth.uid()).

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { endpoint?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const endpoint = body.endpoint?.toString().trim();
  if (!endpoint) return json({ ok: false, error: 'missing_endpoint' }, 400);

  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ ok: false, error: 'unauthenticated' }, 401);

  // RLS-Delete-Policy verlangt user_id = auth.uid() → kann nur eigene löschen
  const { error } = await client
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
