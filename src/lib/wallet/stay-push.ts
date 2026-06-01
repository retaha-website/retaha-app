// Sprint Wallet · Modul D — Stay-Push-Send-Logik
//
// sendStayPush(stayId, triggerType, opts?) ist der zentrale Aufruf für alle
// 9 Trigger-Typen. Wird aufgerufen aus:
//   - /api/bookings/create.ts        (restaurant_reservation, spa_reservation)
//   - /api/bookings/update-status.ts (service_confirmed, service_declined,
//                                     late_checkout_approved, housekeeping_done)
//   - /api/admin/stay-push/room-ready (manueller Hotelier-Button)
//   - /api/cron/stay-push-scheduler  (checkout_reminder)
//   - (Backlog: welcome via Mews-Sync oder erstem Wallet-Open)
//
// Flow:
//   1. Stay laden + verknüpften Wallet-Pass via guest_email finden
//   2. canSendPush(pass, 'service') — Service-Push ignoriert opted_out
//   3. Template laden (hotel_id + trigger_type), is_active prüfen
//   4. Pre-Insert stay_push_sends mit sent_at=null (Idempotenz via UNIQUE-Index)
//      → bei Conflict: dieser Trigger wurde schon gesendet, no-op
//   5. pickI18n + renderVariables mit Stay-Context
//   6. addMessageToPass
//   7. UPDATE stay_push_sends mit sent_at oder failed_reason
//
// Best-Effort durchgängig: alle Fehler werden geloggt aber nie geworfen —
// Booking-Flow / Cron darf nicht scheitern.

import { createSupabaseServiceRoleInstance } from '../auth';
import { canSendPush } from './push-guard';
import { addMessageToPass } from './google';
import { renderVariables, type VariableContext } from '../marketing/variables';
import { pickI18n } from '../i18n/picker';
import { asLanguageCode } from '../i18n/save-hook';
import type { LanguageCode } from '../i18n/types';

export type StayPushTrigger =
  | 'welcome' | 'service_confirmed' | 'service_declined'
  | 'late_checkout_approved' | 'restaurant_reservation'
  | 'spa_reservation' | 'housekeeping_done' | 'room_ready'
  | 'checkout_reminder';

export interface SendStayPushOptions {
  /** Booking-ID — bei service-Triggern + restaurant/spa/late_checkout/housekeeping.
   *  Schlüssel für Idempotenz (kann pro Booking neu feuern). */
  bookingId?: string;
  /** Bereits geladene Booking-Details (vermeidet extra Query) */
  bookingDetails?: Record<string, any>;
}

export interface SendStayPushResult {
  ok: boolean;
  status: 'sent' | 'skipped_already_sent' | 'skipped_no_pass' | 'skipped_template_inactive'
        | 'skipped_template_missing' | 'skipped_guard' | 'skipped_no_object_id' | 'error';
  message?: string;
  triggerType: StayPushTrigger;
  stayId: string;
}

// ─── Plain-text helper (Pushes sind Plain-Text, kein HTML) ───────────────
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ─── Stay-Context-Builder ────────────────────────────────────────────────
function buildStayCtx(args: {
  pass: any;
  hotelName: string;
  stay: any;
  roomNumber: string | null;
  bookingDetails?: Record<string, any>;
  lang: LanguageCode;
}): VariableContext & Record<string, any> {
  const { pass, hotelName, stay, roomNumber, bookingDetails, lang } = args;
  const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
  const locale = localeMap[lang] || 'de-DE';

  const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // checkout_time aus stays.check_out (HH:MM)
  let checkoutTime = '';
  if (stay?.check_out) {
    const d = new Date(stay.check_out);
    if (!isNaN(d.getTime())) {
      checkoutTime = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
  }

  // booking-spezifisch: guest_count, date, time
  const b = bookingDetails ?? {};
  const guestCount = b.people ?? b.guests ?? b.guest_count ?? '';
  const bookingDate = b.date ? fmtDate(b.date) : '';
  const bookingTime = b.time ?? '';

  return {
    first_name: pass.guest_first_name || '',
    last_name: pass.guest_last_name || '',
    hotel_name: hotelName,
    visit_count: pass.visit_count ?? 1,
    last_visit_date: fmtDate(pass.last_visit_at),
    first_visit_date: fmtDate(pass.first_visit_at),
    checkout_time: checkoutTime,
    room_number: roomNumber || '',
    guest_count: guestCount ? String(guestCount) : '',
    date: bookingDate,
    time: bookingTime,
  };
}

// ─── sendStayPush ────────────────────────────────────────────────────────
export async function sendStayPush(
  stayId: string,
  triggerType: StayPushTrigger,
  options: SendStayPushOptions = {},
): Promise<SendStayPushResult> {
  const bookingId = options.bookingId ?? null;
  const baseResult = { triggerType, stayId };

  try {
    const sb = createSupabaseServiceRoleInstance();

    // 1. Stay + Guest + Room laden
    const { data: stay } = await sb
      .from('stays')
      .select('id, hotel_id, check_out, room_id, guests!inner(email, first_name, last_name, language), rooms:room_id(room_number)')
      .eq('id', stayId)
      .maybeSingle();
    if (!stay) {
      return { ...baseResult, ok: false, status: 'error', message: 'stay_not_found' };
    }
    const guest = Array.isArray((stay as any).guests) ? (stay as any).guests[0] : (stay as any).guests;
    if (!guest?.email) {
      return { ...baseResult, ok: false, status: 'skipped_no_pass', message: 'guest_email_missing' };
    }
    const room = Array.isArray((stay as any).rooms) ? (stay as any).rooms[0] : (stay as any).rooms;
    const roomNumber = room?.room_number ?? null;

    // 2. Wallet-Pass via (hotel_id, guest_email) finden
    const { data: pass } = await sb
      .from('wallet_passes')
      .select('id, hotel_id, state, marketing_consent_given, guest_first_name, guest_last_name, visit_count, first_visit_at, last_visit_at, google_object_id')
      .eq('hotel_id', stay.hotel_id)
      .eq('guest_email', guest.email)
      .maybeSingle();
    if (!pass) {
      return { ...baseResult, ok: false, status: 'skipped_no_pass', message: 'no_wallet_pass_for_guest' };
    }

    // 3. canSendPush mit 'service' — opted_out wird IGNORIERT (Vertragserfüllung)
    const guard = canSendPush({
      state: pass.state as 'active' | 'opted_out' | 'expired',
      marketingConsentGiven: pass.marketing_consent_given,
      pushType: 'service',
    });
    if (!guard.canSend) {
      return { ...baseResult, ok: false, status: 'skipped_guard', message: guard.reason };
    }

    if (!pass.google_object_id) {
      return { ...baseResult, ok: false, status: 'skipped_no_object_id', message: 'pass_not_synced_to_google' };
    }

    // 4. Template laden
    const { data: template } = await sb
      .from('stay_push_templates')
      .select('id, title_i18n, body_i18n, is_active')
      .eq('hotel_id', stay.hotel_id)
      .eq('trigger_type', triggerType)
      .maybeSingle();
    if (!template) {
      return { ...baseResult, ok: false, status: 'skipped_template_missing' };
    }
    if (!template.is_active) {
      return { ...baseResult, ok: false, status: 'skipped_template_inactive' };
    }

    // 5. Idempotenz-Insert: stay_push_sends mit sent_at=null. UNIQUE-Index
    //    knallt bei Conflict → wir wurden vom DB-Constraint geblockt = already sent.
    const langForSend = asLanguageCode(guest.language);
    const { data: sendRow, error: insErr } = await sb
      .from('stay_push_sends')
      .insert({
        wallet_pass_id: pass.id,
        stay_id: stay.id,
        trigger_type: triggerType,
        booking_id: bookingId,
        sent_at: null,
        lang_used: langForSend.slice(0, 2),
      })
      .select('id')
      .single();
    if (insErr) {
      // 23505 = unique_violation (Postgres) — Trigger schon gesendet
      const msg = insErr.message || '';
      if (msg.includes('uniq_stay_push_idempotent') || (insErr as any).code === '23505') {
        return { ...baseResult, ok: true, status: 'skipped_already_sent' };
      }
      console.warn(`[stay-push ${triggerType}] insert failed:`, msg);
      return { ...baseResult, ok: false, status: 'error', message: msg };
    }
    const sendId = sendRow!.id;

    // 6. Hotel + i18n + Variables
    const { data: hotel } = await sb
      .from('hotels').select('name, default_language').eq('id', stay.hotel_id).single();
    const hotelDefault = asLanguageCode(hotel?.default_language);
    const hotelName = hotel?.name || 'Hotel';

    const titleRaw = pickI18n(template.title_i18n as any, hotelDefault, langForSend);
    const bodyRaw  = pickI18n(template.body_i18n as any,  hotelDefault, langForSend);
    const ctx = buildStayCtx({
      pass, hotelName, stay, roomNumber,
      bookingDetails: options.bookingDetails, lang: langForSend,
    });
    const title = renderVariables(titleRaw, ctx);
    const body  = renderVariables(htmlToPlain(bodyRaw), ctx);

    // 7. Send via Google Wallet
    const sendResult = await addMessageToPass({
      walletPassUuid: pass.id,
      hotelId: stay.hotel_id,
      header: title,
      body,
      messageId: `stay-${stay.id}-${triggerType}${bookingId ? `-${bookingId}` : ''}`,
    });

    // 8. Final state in stay_push_sends
    if (sendResult.ok) {
      await sb.from('stay_push_sends').update({
        sent_at: new Date().toISOString(),
      }).eq('id', sendId);
      console.info(`[stay-push ${triggerType}] sent · stay=${stay.id.slice(0,8)} pass=${pass.id.slice(0,8)}`);
      return { ...baseResult, ok: true, status: 'sent' };
    } else {
      if (sendResult.status === 'object_not_found') {
        await sb.from('wallet_passes').update({
          state: 'opted_out', opted_out_at: new Date().toISOString(),
          opted_out_reason: 'object_404_in_google_wallet',
        }).eq('id', pass.id);
      }
      const reason = sendResult.status + (sendResult.message ? `: ${sendResult.message.slice(0, 200)}` : '');
      await sb.from('stay_push_sends').update({
        failed_reason: reason,
      }).eq('id', sendId);
      return { ...baseResult, ok: false, status: 'error', message: reason };
    }
  } catch (err) {
    console.warn(`[stay-push ${triggerType}] uncaught:`, (err as Error).message);
    return { ...baseResult, ok: false, status: 'error', message: (err as Error).message };
  }
}
