// @retaha/marketing · email-transport.ts
//
// Provider-Resolver für den Marketing-E-Mail-Versand, pro Hotel, pro Versand
// aufgelöst. Kampagnen-Logik bleibt unberührt — hier entscheidet sich nur,
// WELCHER Transport (ACS vs Resend) und mit WELCHEM Absender gesendet wird.
//
// Regeln:
//   - Default (kein Setup / Schalter aus) → ACS, retaha-Standardabsender.
//   - hotel_settings.marketing_use_own_domain = true UND custom_email_status =
//     'verified' → Resend, Absender = eigene Hotel-Domain.
//   - Schalter an, aber Domain NICHT verifiziert (oder Resend nicht konfiguriert)
//     → BLOCKIERT (kein stiller ACS-Fallback). Aufrufer überspringt den E-Mail-
//     Kanal mit klarer Begründung.

import { getEnv } from '@retaha/db';
import { AcsEmailSender, ResendEmailSender, type EmailSender } from './email-sender';

export type MarketingEmailTransport =
  | { ok: true; provider: 'acs' | 'resend'; sender: EmailSender; from: string }
  | { ok: false; reason: 'own_domain_not_verified' | 'resend_not_configured' | 'acs_not_configured' };

/**
 * Löst den E-Mail-Transport für ein Hotel auf. `sb` = Service-Role-Client.
 */
export async function resolveMarketingEmailTransport(
  sb: any,
  hotelId: string,
  hotelName: string,
): Promise<MarketingEmailTransport> {
  const { data: settings } = await sb
    .from('hotel_settings')
    .select('marketing_use_own_domain, custom_email_domain, custom_email_status')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  const useOwn = settings?.marketing_use_own_domain === true;

  // ── Eigene Domain gewählt → Resend, aber nur wenn wirklich sendefähig ──
  if (useOwn) {
    const domain = (settings?.custom_email_domain as string | null) ?? null;
    const verified = settings?.custom_email_status === 'verified';
    if (!verified || !domain) {
      // Kein stiller Fallback auf retaha — der Inhaber hat die eigene Domain
      // gewählt; ohne Verifizierung wird blockiert statt heimlich umgeleitet.
      return { ok: false, reason: 'own_domain_not_verified' };
    }
    const resendKey = getEnv('RESEND_API_KEY');
    if (!resendKey) return { ok: false, reason: 'resend_not_configured' };

    const safeName = (hotelName || 'retaha').replace(/[<>"\r\n]/g, '').trim() || 'retaha';
    const from = `${safeName} <marketing@${domain}>`;
    return { ok: true, provider: 'resend', sender: new ResendEmailSender(resendKey, from), from };
  }

  // ── Default: ACS / retaha-Standardabsender ──
  const acsConn = getEnv('ACS_CONNECTION_STRING');
  const acsFrom = getEnv('ACS_MAIL_FROM');
  if (!acsConn || !acsFrom) return { ok: false, reason: 'acs_not_configured' };
  return { ok: true, provider: 'acs', sender: new AcsEmailSender(acsConn, acsFrom), from: acsFrom };
}
