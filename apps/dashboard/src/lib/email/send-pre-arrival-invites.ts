// Sprint D · Phase 6a — Pre-Arrival-Email-Trigger
//
// Wird nach erfolgreichem Mews-Sync aufgerufen (syncHotelFromMews). Findet
// alle aktiven Confirmed-Stays mit check_in in [today, today+2 Tage] +
// guests.email != NULL + stays.pre_arrival_sent_at IS NULL.
//
// Für jeden eligible Stay: Pair-Token (TTL bis check_in + 1 Tag) + Email
// versenden + bei Erfolg pre_arrival_sent_at setzen.
//
// Best-Effort: Fehler werden geloggt + übersprungen, nie geworfen. Caller
// (Mews-Sync) muss nicht warten oder catchen.

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { signPairToken } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import { routeEmail } from './router';
import {
  preArrivalInviteHtml,
  preArrivalInviteSubject,
  type PreArrivalInviteData,
} from './templates/pre-arrival-invite';

const LOOKAHEAD_DAYS = 2;

interface EligibleStay {
  id: string;
  hotel_id: string;
  check_in: string;
  check_out: string;
  guest_first_name: string | null;
  guest_email: string;
}

function formatLongGermanDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Verschickt Pre-Arrival-Mails für alle eligible Stays eines Hotels.
 * Returns Stats: { found, sent, skipped, failed }.
 */
export async function sendPreArrivalInvitesForHotel(hotelId: string): Promise<{
  found: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const stats = { found: 0, sent: 0, skipped: 0, failed: 0 };

  try {
    const sb = createSupabaseServiceRoleInstance();

    // Hotel-Daten
    const { data: hotel } = await sb
      .from('hotels')
      .select('id, name, logo_primary, logo_dark')
      .eq('id', hotelId)
      .maybeSingle();
    if (!hotel) {
      console.warn('[pre-arrival] hotel not found:', hotelId);
      return stats;
    }

    const { data: settings } = await sb
      .from('hotel_settings')
      .select('accent_color, guest_address_form')
      .eq('hotel_id', hotelId)
      .maybeSingle();

    // Window: heute bis +2 Tage UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const horizon = new Date(today.getTime() + LOOKAHEAD_DAYS * 86_400_000 + 86_400_000); // inkl. Tag 2 ganzer

    // Eligible Stays — Brief: "Anreise in 2 Tagen". Wir nehmen check_in im
    // Fenster [today, today + 2 days], inklusive. Idempotent via
    // pre_arrival_sent_at IS NULL.
    const { data: stays, error } = await sb
      .from('stays')
      .select(`
        id, hotel_id, check_in, check_out, pre_arrival_sent_at,
        guests(first_name, email)
      `)
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .eq('state', 'Confirmed')
      .is('pre_arrival_sent_at', null)
      .gte('check_in', today.toISOString())
      .lt('check_in', horizon.toISOString())
      .limit(100);

    if (error) {
      console.warn('[pre-arrival] stays query failed:', error.message);
      return stats;
    }

    const baseUrl = getEnv('PUBLIC_SITE_URL') ?? 'https://retaha.de';
    const eligible: EligibleStay[] = (stays ?? [])
      .map(s => {
        const g = s.guests as any;
        return {
          id: s.id,
          hotel_id: s.hotel_id,
          check_in: s.check_in,
          check_out: s.check_out,
          guest_first_name: g?.first_name ?? null,
          guest_email: g?.email ?? null,
        };
      })
      .filter((s): s is EligibleStay => typeof s.guest_email === 'string' && s.guest_email.length > 0);

    stats.found = stays?.length ?? 0;

    for (const s of eligible) {
      try {
        // Pair-Token bis check_in + 1 Tag gültig
        const checkInMs = Date.parse(s.check_in);
        const tokenExpiryMs = Number.isFinite(checkInMs)
          ? checkInMs + 86_400_000
          : Date.now() + 7 * 86_400_000;
        const ttlSeconds = Math.max(60, Math.floor((tokenExpiryMs - Date.now()) / 1000));

        const token = await signPairToken({
          stay_id: s.id,
          hotel_id: s.hotel_id,
          ttlSeconds,
        });
        if (!token) {
          console.warn('[pre-arrival] signPairToken failed (no STAY_SESSION_SECRET?) for stay', s.id);
          stats.skipped++;
          continue;
        }

        const pairUrl = `${baseUrl.replace(/\/$/, '')}/api/pair?token=${encodeURIComponent(token)}`;

        const data: PreArrivalInviteData = {
          hotelName: hotel.name ?? 'Hotel',
          hotelLogoUrl: (hotel as any).logo_primary ?? (hotel as any).logo_dark ?? null,
          hotelAccentColor: settings?.accent_color ?? null,
          guestFirstName: s.guest_first_name,
          checkInLabel: formatLongGermanDate(s.check_in),
          checkOutLabel: formatLongGermanDate(s.check_out),
          pairUrl,
          addressForm: (settings?.guest_address_form === 'du' ? 'du' : 'sie'),
        };

        const result = await routeEmail({
          type: 'guest_pre_arrival',
          hotelId: s.hotel_id,
          to: s.guest_email,
          subject: preArrivalInviteSubject(data),
          html: preArrivalInviteHtml(data),
          fromName: hotel.name ?? 'Hotel',
        });

        if (result.ok) {
          await sb.from('stays')
            .update({ pre_arrival_sent_at: new Date().toISOString() })
            .eq('id', s.id);
          stats.sent++;
          console.info(`[pre-arrival] sent stay ${s.id} → ${s.guest_email} (via ${result.provider})`);
        } else {
          stats.failed++;
          console.warn(`[pre-arrival] send failed stay ${s.id} (via ${result.provider}):`, result.error);
        }
      } catch (err) {
        stats.failed++;
        console.warn(`[pre-arrival] unexpected error stay ${s.id}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[pre-arrival] top-level error:', (err as Error).message);
  }

  return stats;
}
