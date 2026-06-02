import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { pushBookingToMews, PushSkipped, cancelBookingInMews, CancelSkipped } from '../../../lib/mews/orders';
import { sendStayPush, type StayPushTrigger } from '@retaha/wallet';

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

  // Sprint E1 Phase 4 — Cancel-Symmetrie: beim Übergang * → cancelled
  // den korrespondierenden Mews-Order via orders/cancel zurücknehmen.
  // Idempotenz schützt cancelBookingInMews selbst (mews_cancelled_at-Check).
  let cancelOutcome: { ok: true; orderId: string } | { ok: false; reason: string; error: string } | null = null;
  if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
    cancelOutcome = await tryCancelBookingInMews(payload.booking_id);
  }

  // Sprint Wallet Modul D — Stay-Push beim Status-Übergang
  // service_confirmed / late_checkout_approved / housekeeping_done bei
  // pending→confirmed (bzw. completed). service_declined bei →cancelled.
  // Best-Effort: sendStayPush fängt alle Fehler intern.
  const booking = updated[0];
  if (booking?.stay_id) {
    let trigger: StayPushTrigger | null = null;
    if (oldStatus !== 'confirmed' && newStatus === 'confirmed') {
      if (booking.type === 'service')        trigger = 'service_confirmed';
      else if (booking.type === 'late_checkout') trigger = 'late_checkout_approved';
      else if (booking.type === 'housekeeping')  trigger = 'housekeeping_done';
    } else if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      if (booking.type === 'service') trigger = 'service_declined';
    }
    if (trigger) {
      await sendStayPush(booking.stay_id, trigger, { bookingId: booking.id, bookingDetails: booking.details ?? {} });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    booking: updated[0],
    mews_push: pushOutcome,
    mews_cancel: cancelOutcome,
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

// Sprint E1 Phase 4 — Symmetrisch zu tryPushBookingToMews.
// Niemals re-throw. Status-Update bleibt erfolgreich auch wenn Cancel fehlschlägt.
async function tryCancelBookingInMews(bookingId: string): Promise<{ ok: true; orderId: string } | { ok: false; reason: string; error: string }> {
  const admin = createSupabaseServiceRoleInstance();
  const cancelledAt = new Date().toISOString();

  try {
    const { orderId } = await cancelBookingInMews(bookingId);
    await admin.from('bookings').update({
      mews_cancelled_at: cancelledAt,
      mews_cancel_error: null,
    }).eq('id', bookingId);
    console.info(`[mews-cancel] booking ${bookingId} → order ${orderId} cancelled`);
    return { ok: true, orderId };
  } catch (err) {
    const isSkip = err instanceof CancelSkipped;
    const reason = isSkip ? err.reason : 'error';
    const message = (err as Error).message ?? String(err);

    // Skip-Reasons die KEIN echter Versuch waren (Pre-Check-Skips):
    //   no_integration / no_mews_order_id / already_cancelled
    // → kein DB-Write nötig.
    // Skip-Reasons die einen Versuch repräsentieren (Mews antwortete):
    //   no_order_items_found / editable_history_expired
    // → DB-Write damit Hotelier sieht warum nichts passiert ist.
    const isAttemptedSkip = isSkip && (
      reason === 'no_order_items_found' ||
      reason === 'editable_history_expired'
    );

    if (isSkip && !isAttemptedSkip) {
      console.info(`[mews-cancel] skip booking ${bookingId} (${reason}): ${message}`);
    } else {
      console.error(`[mews-cancel] booking ${bookingId} ${isAttemptedSkip ? 'attempted-skip' : 'failed'}:`, err);
      await admin.from('bookings').update({
        mews_cancel_error: `${reason}: ${message}`,
      }).eq('id', bookingId);
    }
    return { ok: false, reason, error: message };
  }
}
