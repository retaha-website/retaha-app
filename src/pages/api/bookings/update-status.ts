import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '../../../lib/auth';

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'];

export const POST: APIRoute = async ({ request, cookies }) => {
  const client = createSupabaseServerInstance(cookies, request);

  // Auth check via session
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: { booking_id: string; status: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.booking_id || !payload.status) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing booking_id or status' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!VALID_STATUSES.includes(payload.status)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid status' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // RLS-protected update — user can only update bookings belonging to their hotel
  const { data, error } = await client
    .from('bookings')
    .update({
      status: payload.status.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.booking_id)
    .select('id, status, updated_at')
    .single();

  if (error) {
    console.error('Update status error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, booking: data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
