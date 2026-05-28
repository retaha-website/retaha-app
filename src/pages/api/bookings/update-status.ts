import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { pushBookingToMews, PushSkipped } from '../../../lib/mews/orders';

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

  const newStatus = payload.status.toLowerCase();
  if (!VALID_STATUSES.includes(newStatus)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid status' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pre-Update: alten Status lesen, damit wir den Übergang pending→confirmed
  // erkennen (Sprint C Phase 3 — Mews-Charge nur beim *neuen* confirm).
  const { data: existing } = await client
    .from('bookings')
    .select('id, status')
    .eq('id', payload.booking_id)
    .maybeSingle();
  const oldStatus = existing?.status ?? null;

  // RLS-protected update
  const { data: updated, error } = await client
    .from('bookings')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.booking_id)
    .select('*');

  if (error) {
    console.error('Update status error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!updated || updated.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'Keine Berechtigung oder Datensatz nicht gefunden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mews-Push beim Übergang pending → confirmed.
  // KRITISCH: niemals re-throw. Status-Update ist erfolgreich, Push ist best-effort.
  let pushOutcome: { ok: true; orderId: string } | { ok: false; reason: string; error: string } | null = null;
  if (oldStatus !== 'confirmed' && newStatus === 'confirmed') {
    pushOutcome = await tryPushBookingToMews(payload.booking_id);
  }

  return new Response(JSON.stringify({
    ok: true,
    booking: updated[0],
    mews_push: pushOutcome,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

async function tryPushBookingToMews(bookingId: string): Promise<{ ok: true; orderId: string } | { ok: false; reason: string; error: string }> {
  const admin = createSupabaseServiceRoleInstance();
  const attemptedAt = new Date().toISOString();

  try {
    const { orderId } = await pushBookingToMews(bookingId);
    await admin.from('bookings').update({
      mews_order_id: orderId,
      mews_push_attempted_at: attemptedAt,
      mews_push_error: null,
    }).eq('id', bookingId);
    console.info(`[mews-push] booking ${bookingId} → order ${orderId}`);
    return { ok: true, orderId };
  } catch (err) {
    const isSkip = err instanceof PushSkipped;
    const reason = isSkip ? err.reason : 'error';
    const message = (err as Error).message ?? String(err);
    if (isSkip) {
      console.info(`[mews-push] skip booking ${bookingId} (${reason}): ${message}`);
    } else {
      console.error(`[mews-push] booking ${bookingId} failed:`, err);
    }
    // Logging der Failure auf bookings — Status-Update bleibt erfolgreich
    await admin.from('bookings').update({
      mews_push_attempted_at: attemptedAt,
      mews_push_error: `${reason}: ${message}`,
    }).eq('id', bookingId);
    return { ok: false, reason, error: message };
  }
}
