import type { APIRoute } from 'astro';
import { createServerClient } from '@retaha/db';
import { sendBookingNotification } from '../../../lib/email/send-booking-notification';
import { sendHotelierPush } from '../../../lib/push/send';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { hasPermission, type Role } from '@retaha/auth';
import { sendStayPush, type StayPushTrigger } from '@retaha/wallet';
import { isShowcaseToken, findShowcaseSessionByToken } from '../../../lib/showcase/session';

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

  if (!['breakfast', 'conference', 'service', 'restaurant', 'spa', 'late_checkout', 'housekeeping'].includes(payload.type)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid type' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient();

  // Sprint H · Group 2 — Showcase-Mode-Branch
  // Bei Showcase-Tokens: insert in bookings mit stay_id=NULL +
  // showcase_session_id gesetzt. KEINE Mews-Push, KEINE Email-Notification,
  // KEINE Stay-Push — Demo-Mode ist clean isoliert.
  if (isShowcaseToken(payload.access_token)) {
    const showcase = await findShowcaseSessionByToken(payload.access_token);
    if (!showcase) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid stay' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }
    const admin = createSupabaseServiceRoleInstance();
    const { data: demoBooking, error: demoErr } = await admin.from('bookings').insert({
      hotel_id: showcase.hotel_id,
      stay_id: null,
      showcase_session_id: showcase.id,
      type: payload.type,
      status: 'pending',
      details: payload.details,
    }).select('id, status, created_at').single();
    if (demoErr || !demoBooking) {
      console.error('[bookings/create showcase] insert failed:', demoErr);
      return new Response(JSON.stringify({ ok: false, error: demoErr?.message || 'Insert failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, booking: demoBooking, showcase: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

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

  // Best-Effort Notification — sendBookingNotification fängt alle Fehler intern.
  // Await damit Vercel-Edge die Promise nicht beendet — der Wrapper ist schnell
  // (parallel queries + 1 Resend-POST), Gast-Response verzögert sich um ~100-300ms.
  await sendBookingNotification({
    bookingId: booking.id,
    hotelId: stay.hotel_id,
    stayId: stay.id,
    bookingType: payload.type,
    details: payload.details,
  });

  // Sprint Functional Modul D · Phase 10 — Hotelier-Push bei Service-Anfragen
  // (andere Booking-Typen kommen über Email; Push nur für sofort-handelnde Items).
  if (payload.type === 'service') {
    try {
      const admin = createSupabaseServiceRoleInstance();
      const { data: members } = await admin
        .from('hotel_users')
        .select('user_id, role')
        .eq('hotel_id', stay.hotel_id)
        .not('accepted_at', 'is', null);

      const eligibleUserIds = (members ?? [])
        .filter(m => hasPermission(m.role as Role, 'operations.read'))
        .map(m => m.user_id);

      if (eligibleUserIds.length > 0) {
        // Room/Item-Label für aussagekräftige Notification
        const { data: stayRow } = await admin
          .from('stays')
          .select('rooms(room_number, room_name), guests(first_name, last_name)')
          .eq('id', stay.id)
          .maybeSingle();
        const room: any = (stayRow as any)?.rooms;
        const roomLabel = room
          ? [room.room_number, room.room_name].filter(Boolean).join(' · ')
          : null;
        const itemName = (payload.details as any)?.item_name || 'Service-Anfrage';
        const body = roomLabel
          ? `${roomLabel}: ${itemName}`
          : itemName;

        await sendHotelierPush({
          hotelId: stay.hotel_id,
          userIds: eligibleUserIds,
          payload: {
            title: 'Neue Service-Anfrage',
            body,
            url: `/service?booking=${booking.id}`,
            tag: `booking-${booking.id}`,
          },
        });
      }
    } catch (err) {
      console.warn('[push] service-trigger failed (non-fatal):', err);
    }
  }

  // Sprint Wallet Modul D — Stay-Push für create-Trigger (restaurant/spa).
  // service-Bookings landen mit status='pending' → kein Push hier; service_confirmed
  // feuert erst beim Status-Update auf 'confirmed' (update-status.ts).
  // Best-Effort: sendStayPush fängt alle Fehler intern.
  const STAY_PUSH_CREATE_MAP: Record<string, StayPushTrigger | undefined> = {
    restaurant: 'restaurant_reservation',
    spa:        'spa_reservation',
  };
  const stayPushTrigger = STAY_PUSH_CREATE_MAP[payload.type];
  if (stayPushTrigger) {
    await sendStayPush(stay.id, stayPushTrigger, { bookingId: booking.id, bookingDetails: payload.details });
  }

  return new Response(JSON.stringify({ ok: true, booking }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
