// Top-Level-Trigger: lädt hotel_settings, baut Notification-Email, sendet via Resend.
// Best-Effort: niemals throwen. Aufrufer (api/bookings/create) kann fire-and-forget.

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { hotelOwnerFirstName } from '@retaha/auth';
import { routeEmail } from './router';
import {
  bookingNotificationHtml,
  bookingNotificationSubject,
  type BookingNotificationData,
} from './templates/booking-notification';

export interface BookingNotificationContext {
  bookingId: string;
  hotelId: string;
  stayId: string;
  bookingType: 'breakfast' | 'service' | 'conference';
  details: any;
}

const TYPE_LABELS_SUMMARY: Record<string, (details: any) => string | null> = {
  breakfast: d => {
    const parts: string[] = [];
    if (d?.people) parts.push(`${d.people} ${d.people === 1 ? 'Person' : 'Personen'}`);
    if (d?.table_preference && d.table_preference !== 'any') parts.push(d.table_preference);
    return parts.length > 0 ? parts.join(' · ') : null;
  },
  service: d => d?.item_name ?? null,
  conference: d => {
    const parts: string[] = [];
    if (d?.room_name) parts.push(d.room_name);
    if (d?.duration_hours) parts.push(`${d.duration_hours}h`);
    if (d?.people) parts.push(`${d.people} ${d.people === 1 ? 'Person' : 'Personen'}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  },
};

function formatScheduledFor(type: string, details: any): string | null {
  if (!details?.date) return null;
  const time = details.time ? ` ${details.time}` : '';
  return `${details.date}${time}`;
}

export async function sendBookingNotification(ctx: BookingNotificationContext): Promise<void> {
  try {
    const sb = createSupabaseServiceRoleInstance();

    // Hotel + Settings + Stay + Guest + Room in einem Schub
    const [hotelRes, settingsRes, stayRes] = await Promise.all([
      sb.from('hotels')
        .select('id, name, slug, logo_primary, logo_dark')
        .eq('id', ctx.hotelId)
        .maybeSingle(),
      sb.from('hotel_settings')
        .select('notification_email, accent_color')
        .eq('hotel_id', ctx.hotelId)
        .maybeSingle(),
      sb.from('stays')
        .select(`
          id,
          guests(first_name, last_name),
          rooms(room_number, room_name)
        `)
        .eq('id', ctx.stayId)
        .maybeSingle(),
    ]);

    const hotel = hotelRes.data;
    const settings = settingsRes.data;
    const notificationEmail = settings?.notification_email;
    if (!hotel) {
      console.warn('[notif] hotel not found:', ctx.hotelId, hotelRes.error?.message ?? '');
      return;
    }
    if (!notificationEmail) {
      console.info('[notif] no notification_email for hotel', ctx.hotelId, '— skipped');
      return;
    }

    const guest = stayRes.data?.guests as any;
    const room = stayRes.data?.rooms as any;
    const guestName = [guest?.first_name, guest?.last_name].filter(Boolean).join(' ').trim() || 'Gast';
    const roomLabel = room?.room_number
      ? `${room.room_number}${room.room_name ? ` (${room.room_name})` : ''}`
      : room?.room_name ?? null;

    const summary = TYPE_LABELS_SUMMARY[ctx.bookingType]?.(ctx.details) ?? null;
    const scheduledFor = formatScheduledFor(ctx.bookingType, ctx.details);

    const baseUrl = getEnv('PUBLIC_SITE_URL') ?? 'https://retaha.de';
    const backofficeUrl = `${baseUrl.replace(/\/$/, '')}/admin/bookings`;

    const data: BookingNotificationData = {
      hotelName: hotel.name ?? 'Hotel',
      hotelLogoUrl: (hotel as any).logo_primary ?? (hotel as any).logo_dark ?? null,
      hotelAccentColor: settings?.accent_color ?? null,
      recipientFirstName: await hotelOwnerFirstName(ctx.hotelId),
      guestName,
      roomLabel,
      bookingType: ctx.bookingType,
      scheduledFor,
      detailsSummary: summary,
      backofficeUrl,
    };

    // Comma-Split für Multi-Recipient
    const recipients = notificationEmail
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    // Hotelier-Notification = internal → Router schickt via Microsoft 365 SMTP.
    const result = await routeEmail({
      type: 'hotelier_notification',
      hotelId: ctx.hotelId,
      to: recipients,
      subject: bookingNotificationSubject(data),
      html: bookingNotificationHtml(data),
      fromName: hotel.name ?? 'Hotel',
    });

    if (result.ok) {
      console.info(`[notif] booking ${ctx.bookingId} → ${recipients.length} recipient(s), id=${result.id} (via ${result.provider})`);
    } else {
      console.warn(`[notif] booking ${ctx.bookingId} email failed (via ${result.provider}): ${result.error}`);
    }
  } catch (err) {
    // Niemals throwen — Best-Effort
    console.warn('[notif] unexpected error:', (err as Error).message);
  }
}
