// Sprint Functional Modul D · Phase 10 — Push-Status-Check
//
// GET /api/admin/push/status?endpoint=<urlencoded>
// Antwort: { ok, subscribed } — Client nutzt das beim Page-Load um zu wissen
// ob der aktuelle Browser bereits subscribt ist.

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const endpoint = url.searchParams.get('endpoint')?.trim();
  if (!endpoint) return json({ ok: true, subscribed: false });

  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ ok: false, error: 'unauthenticated' }, 401);

  const { data, error } = await client
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, subscribed: !!data });
};
