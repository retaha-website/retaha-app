import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

interface CreateBookingPayload {
  access_token: string;
  type: 'breakfast' | 'conference' | 'service';
  details: Record<string, any>;
}

export const POST: APIRoute = async ({ request }) => {
  let payload: CreateBookingPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.access_token || !payload.type || !payload.details) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!['breakfast', 'conference', 'service'].includes(payload.type)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid type' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient();

  // Verify token → resolve to stay
  const { data: stay, error: stayErr } = await supabase
    .from('stays')
    .select('id, hotel_id, is_active')
    .eq('access_token', payload.access_token)
    .eq('is_active', true)
    .maybeSingle();

  if (stayErr || !stay) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid stay' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      hotel_id: stay.hotel_id,
      stay_id: stay.id,
      type: payload.type,
      status: 'pending',
      details: payload.details,
    })
    .select('id, status, created_at')
    .single();

  if (bookingErr || !booking) {
    console.error('Booking insert failed:', bookingErr);
    return new Response(JSON.stringify({ ok: false, error: bookingErr?.message || 'Insert failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, booking }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
