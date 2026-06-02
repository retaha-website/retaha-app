// Sprint Functional Modul D · Phase 10 — Hotelier-Push abonnieren
//
// POST /api/admin/push/subscribe
// Body: { endpoint, keys: { p256dh, auth } }
// Auth: User-Session (cookie). User muss Member des aktuellen Hotels sein.
// Rate-Limit: pro User max 5 aktive Subscriptions (verschiedene Devices).

import type { APIRoute } from 'astro';
import { createSupabaseServerInstance, createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';

const MAX_SUBS_PER_USER = 5;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: SubscribeBody;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const endpoint = body.endpoint?.toString().trim();
  const p256dh = body.keys?.p256dh?.toString().trim();
  const auth = body.keys?.auth?.toString().trim();
  if (!endpoint || !p256dh || !auth) {
    return json({ ok: false, error: 'missing_subscription_fields' }, 400);
  }

  // Auth via Cookie-Session
  const client = createSupabaseServerInstance(cookies, request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ ok: false, error: 'unauthenticated' }, 401);

  // Hotel-Membership prüfen (alle Rollen dürfen abonnieren — Push-Permissions
  // werden beim SEND-Zeitpunkt gegen operations.read gefiltert)
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const admin = createSupabaseServiceRoleInstance();

  // Rate-Limit: max 5 Subs pro User
  const { count } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (count !== null && count >= MAX_SUBS_PER_USER) {
    return json({ ok: false, error: 'too_many_subscriptions', limit: MAX_SUBS_PER_USER }, 429);
  }

  // Upsert via UNIQUE(endpoint) — gleicher Browser, Re-Subscribe ist legitim
  // (z.B. nach Browser-Update). Setzt user_id/hotel_id neu.
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
  const { error } = await admin.from('push_subscriptions').upsert({
    hotel_id: hotel.id,
    user_id: user.id,
    stay_id: null,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
  }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe] insert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
