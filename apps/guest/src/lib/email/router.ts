// Sprint D · Phase 7 — Email-Provider-Router
//
// Hybrid-Setup:
//   - Microsoft 365 SMTP (noreply@retaha.de) → interne Hotelier-Mails
//   - Resend mit Hotel-Custom-Domain (welcome@<hotel-domain>) → Customer-Facing
//
// Decision-Logic in routeEmail():
//   - type='hotelier_notification' → Microsoft, fromName=hotel.name
//   - type='guest_pre_arrival' (oder andere guest_*-Types) → Resend wenn
//     hotel_settings.custom_email_status='verified', sonst Microsoft Fallback
//
// Bei Fallback auf Microsoft wird die Mail trotzdem versendet — der Gast
// bekommt sie von noreply@retaha.de statt von welcome@<custom>. Premium-
// Polish degradiert sauber.

import { sendEmail as sendMicrosoftEmail } from './microsoft-smtp';
import { sendResendEmail } from './resend';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

export type EmailType =
  | 'hotelier_notification'   // Booking-Alert an Hannah/Kirstin (intern)
  | 'guest_pre_arrival'        // Pre-Arrival-Invite an Gast (customer-facing)
  | 'guest_generic';           // Generischer Customer-Facing-Fallback

export interface RouteEmailParams {
  type: EmailType;
  hotelId: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Display-Name (Hotel-Name). Wird zu "<Name> <sender@domain>" zusammengesetzt. */
  fromName: string;
  replyTo?: string;
}

export interface RouteEmailResult {
  ok: boolean;
  provider: 'microsoft' | 'resend' | 'none';
  id?: string;
  error?: string;
}

const MICROSOFT_FALLBACK_LOCAL = 'noreply';   // local-part von noreply@retaha.de
const MICROSOFT_FALLBACK_DOMAIN = 'retaha.de';

interface HotelEmailConfig {
  custom_email_domain: string | null;
  custom_email_status: string | null;
}

async function loadHotelEmailConfig(hotelId: string): Promise<HotelEmailConfig | null> {
  try {
    const sb = createSupabaseServiceRoleInstance();
    const { data } = await sb
      .from('hotel_settings')
      .select('custom_email_domain, custom_email_status')
      .eq('hotel_id', hotelId)
      .maybeSingle();
    return data ?? { custom_email_domain: null, custom_email_status: null };
  } catch (err) {
    console.warn('[email/router] loadHotelEmailConfig failed:', (err as Error).message);
    return null;
  }
}

export async function routeEmail(params: RouteEmailParams): Promise<RouteEmailResult> {
  // Microsoft-Pfad — Hotelier-interne Mails
  if (params.type === 'hotelier_notification') {
    const res = await sendMicrosoftEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      fromName: params.fromName,
      replyTo: params.replyTo,
    });
    return { ok: res.ok, provider: 'microsoft', id: res.messageId, error: res.error };
  }

  // Customer-Facing: Resend mit Custom-Domain, fallback Microsoft
  const config = await loadHotelEmailConfig(params.hotelId);
  const hasVerifiedDomain =
    config?.custom_email_status === 'verified' &&
    typeof config.custom_email_domain === 'string' &&
    config.custom_email_domain.length > 0;

  if (hasVerifiedDomain) {
    const escapedName = params.fromName.replace(/"/g, '\\"');
    const from = `"${escapedName}" <welcome@${config!.custom_email_domain}>`;
    const res = await sendResendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      from,
      replyTo: params.replyTo,
    });
    if (res.ok) {
      return { ok: true, provider: 'resend', id: res.id };
    }
    // Resend hat gefailed → fallback auf Microsoft mit Warning. Mail kommt an,
    // nur ohne Hotel-Custom-Domain als Absender.
    console.warn(`[email/router] Resend send failed for hotel ${params.hotelId}, falling back to Microsoft: ${res.error}`);
  }

  // Microsoft-Fallback für Customer-Facing (Hotel hat keine verified Domain)
  const ms = await sendMicrosoftEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
    fromName: params.fromName,
    replyTo: params.replyTo,
  });
  return {
    ok: ms.ok,
    provider: 'microsoft',
    id: ms.messageId,
    error: ms.error,
  };
}

export { MICROSOFT_FALLBACK_LOCAL, MICROSOFT_FALLBACK_DOMAIN };
