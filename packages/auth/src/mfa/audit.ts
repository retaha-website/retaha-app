/**
 * MFA-Audit-Log Writes
 *
 * DSGVO-Pflicht: Sicherheits-Events ueber 2FA-Setup, Code-Verifizierung,
 * Recovery-Verwendung etc. mussen protokolliert werden (Audit-Trail).
 *
 * Pseudonymisierung:
 *   - KEINE IP-Adressen
 *   - Nur country_code (z.B. 'DE') + ua_family (z.B. 'Safari')
 *   - User selbst sieht Audit ueber /admin/sicherheit/historie (Sprint-J)
 *
 * Service-Role-Insert: weil RLS-Policy nur SELECT fuer User erlaubt,
 * INSERT muss ueber server-side service_role passieren.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type MfaEventType =
  | 'setup_started'
  | 'setup_completed'
  | 'code_verified'
  | 'code_failed'
  | 'recovery_used'
  | 'disabled'
  | 'team_policy_changed'
  | 'low_recovery_warning';

export interface MfaAuditMetadata {
  /** ISO-2 Country-Code aus IP-Geo (NICHT IP selbst!) */
  country?: string;
  /** Browser-Family (Safari, Firefox, Chrome, etc.) — NICHT exakter User-Agent */
  ua_family?: string;
  /** Device-Type: 'mobile' | 'tablet' | 'desktop' */
  device?: 'mobile' | 'tablet' | 'desktop';
  /** Optionaler Kontext, z.B. ungueltige Code-Anzahl bei code_failed */
  context?: Record<string, string | number | boolean>;
}

export interface LogMfaEventInput {
  userId: string;
  eventType: MfaEventType;
  /** Bei team_policy_changed: das betroffene Hotel */
  hotelId?: string;
  metadata?: MfaAuditMetadata;
}

/**
 * Schreibt einen Audit-Eintrag. Server-side, NACH erfolgreicher User-Auth-Check.
 * Fehler werden geloggt aber nicht geworfen (Audit-Failures duerfen nicht den
 * eigentlichen Flow blockieren — Sicherheits-Trade-off).
 */
export async function logMfaEvent(
  supabase: SupabaseClient,
  input: LogMfaEventInput,
): Promise<void> {
  const { error } = await supabase.from('mfa_audit_log').insert({
    user_id: input.userId,
    hotel_id: input.hotelId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[mfa-audit] Failed to write event:', input.eventType, error);
  }
}

/**
 * Hilfsfunktion: Browser-Family aus User-Agent extrahieren.
 * Nur basic-Match — kein voller UA-Parser noetig.
 */
export function parseUaFamily(userAgent: string | null | undefined): string {
  if (!userAgent) return 'unknown';
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return 'Safari';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Edg/i.test(userAgent)) return 'Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  return 'other';
}

/**
 * Hilfsfunktion: Device-Type aus User-Agent.
 */
export function parseDevice(userAgent: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
  if (/Mobile|iPhone|Android.*Mobile/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
