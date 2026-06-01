// Sprint Functional Modul D · Phase 9 — Push-Send-Wrapper
//
// Server-seitiger Wrapper um web-push. Best-Effort: Fehler werden geloggt
// aber nie propagiert (Push darf den eigentlichen Booking-Flow nicht
// zerschießen). Stale Subscriptions (410/404 vom Push-Service) werden
// automatisch aus der DB entfernt.

import webPush from 'web-push';
import { createSupabaseServiceRoleInstance } from '../auth';
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject, isPushConfigured } from './config';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return true;
  const priv = getVapidPrivateKey();
  if (!priv) {
    console.warn('[push] VAPID_PRIVATE_KEY fehlt — Push deaktiviert.');
    return false;
  }
  webPush.setVapidDetails(getVapidSubject(), getVapidPublicKey(), priv);
  vapidInitialized = true;
  return true;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToOne(sub: SubscriptionRow, payload: PushPayload): Promise<{ id: string; gone: boolean; ok: boolean }> {
  try {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },  // 24h
    );
    return { id: sub.id, gone: false, ok: true };
  } catch (err: any) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      // Subscription endgültig invalid — DB aufräumen.
      return { id: sub.id, gone: true, ok: false };
    }
    console.warn('[push] send failed (status', status, '):', err?.body || err?.message);
    return { id: sub.id, gone: false, ok: false };
  }
}

/**
 * Push an alle Hotel-User-Subscriptions, optional gefiltert per User-IDs.
 * Stale Subs werden im Hintergrund gelöscht (best-effort).
 */
export async function sendHotelierPush(params: {
  hotelId: string;
  userIds?: string[];   // wenn gesetzt: nur diese User; sonst alle Subs des Hotels
  payload: PushPayload;
}): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!isPushConfigured() || !ensureVapid()) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const sb = createSupabaseServiceRoleInstance();
  let q = sb.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('hotel_id', params.hotelId)
    .not('user_id', 'is', null);
  if (params.userIds && params.userIds.length > 0) {
    q = q.in('user_id', params.userIds);
  }
  const { data: subs, error } = await q;
  if (error) {
    console.warn('[push] load subs failed:', error.message);
    return { sent: 0, failed: 0, cleaned: 0 };
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const results = await Promise.all((subs as SubscriptionRow[]).map(s => sendToOne(s, params.payload)));
  const goneIds = results.filter(r => r.gone).map(r => r.id);
  if (goneIds.length > 0) {
    const { error: delErr } = await sb.from('push_subscriptions').delete().in('id', goneIds);
    if (delErr) console.warn('[push] cleanup failed:', delErr.message);
  }
  // last_used_at touchen für erfolgreich zugestellte Subs (analytics)
  const okIds = results.filter(r => r.ok).map(r => r.id);
  if (okIds.length > 0) {
    await sb.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', okIds);
  }
  return {
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok && !r.gone).length,
    cleaned: goneIds.length,
  };
}
