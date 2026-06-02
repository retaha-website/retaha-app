/**
 * UX-017 P2 — Manueller Re-Try für fehlgeschlagene Mews-Charges.
 *
 * POST /api/bookings/[id]/retry-mews-push
 * Auth: Hotelier-Session-Cookie (cross-subdomain) + RLS-Hotel-Ownership-Check
 *       via createSupabaseServerInstance.
 *
 * Flow:
 *   1. Auth-Check (Session-Cookie via @retaha/auth)
 *   2. Booking via RLS-Client laden (RLS lehnt fremde Hotels ab → 404)
 *   3. pushBookingToMews(bookingId) versuchen
 *   4. Bei Erfolg: mews_order_id + mews_push_attempted_at, mews_push_error=null
 *   5. Bei Fehler: mews_push_attempted_at + mews_push_error persistieren
 *   6. Return { success, mews_order_id?, error?, attempted_at }
 *
 * Wirft NIE 500 wenn Mews-Push failt — Failure wird in DB persistiert,
 * Response ist 200 mit success=false.
 */

import type { APIRoute } from 'astro';
import {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';
import { pushBookingToMews, PushSkipped } from '../../../../lib/mews/orders';

function json(body: any, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const bookingId = params.id;
  if (!bookingId) return json({ success: false, error: 'missing-id' }, 400);

  // 1. Auth via Cross-Subdomain Cookie
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ success: false, error: 'not-authenticated' }, 401);

  // 2. Booking-Ownership via RLS (returns null wenn Hotel nicht owned)
  const { data: booking, error: loadError } = await client
    .from('bookings')
    .select('id, hotel_id, status, type, mews_order_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (loadError) {
    console.error('[retry-mews-push] load error:', loadError);
    return json({ success: false, error: 'load-failed' }, 500);
  }
  if (!booking) return json({ success: false, error: 'not-found' }, 404);

  // 3. Push versuchen, 4-5. DB-Update mit Erfolg/Fehler
  const admin = createSupabaseServiceRoleInstance();
  const attemptedAt = new Date().toISOString();

  try {
    const { orderId } = await pushBookingToMews(bookingId);
    await admin.from('bookings').update({
      mews_order_id: orderId,
      mews_push_attempted_at: attemptedAt,
      mews_push_error: null,
    }).eq('id', bookingId);
    console.info(`[retry-mews-push] booking ${bookingId} → order ${orderId}`);
    return json({
      success: true,
      mews_order_id: orderId,
      attempted_at: attemptedAt,
    }, 200);
  } catch (err) {
    const isSkip = err instanceof PushSkipped;
    const reason = isSkip ? err.reason : 'error';
    const message = (err as Error).message ?? String(err);
    const errorString = `${reason}: ${message}`;
    if (isSkip) {
      console.info(`[retry-mews-push] skip booking ${bookingId} (${reason}): ${message}`);
    } else {
      console.error(`[retry-mews-push] booking ${bookingId} failed:`, err);
    }
    await admin.from('bookings').update({
      mews_push_attempted_at: attemptedAt,
      mews_push_error: errorString,
    }).eq('id', bookingId);
    // Status 200 — Failure ist erwarteter Outcome, Frontend zeigt Error-Toast.
    return json({
      success: false,
      error: errorString,
      attempted_at: attemptedAt,
    }, 200);
  }
};
