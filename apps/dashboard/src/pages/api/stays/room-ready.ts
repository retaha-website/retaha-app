import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';
import { sendStayPush } from '@retaha/wallet';

export const POST: APIRoute = async ({ request, cookies }) => {
  const client = createSupabaseServerInstance(cookies, request);

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: { stay_id: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.stay_id) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing stay_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the stay belongs to a hotel the authenticated user owns (RLS enforced via client)
  const { data: stay } = await client
    .from('stays')
    .select('id, hotel_id')
    .eq('id', payload.stay_id)
    .maybeSingle();

  if (!stay) {
    return new Response(JSON.stringify({ ok: false, error: 'Stay not found or access denied' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await sendStayPush(stay.id, 'room_ready');

  return new Response(JSON.stringify({ ok: result.ok, status: result.status, message: result.message }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
