// Sprint C Phase 3 — Charge-to-Room Push (Custom Items)
//
// pushBookingToMews(bookingId): Top-Level-Orchestrator
//   - lädt Booking + Stay + Guest + Hotel-Integration + Hotel-Settings
//   - Skip-Conditions (kein Error werfen):
//       · keine mews_integration → kein Mews verbunden
//       · pricing_source !== 'retaha' → Pfad C+ (NotImplementedError)
//       · kein mews_reservation_id auf der Stay
//       · kein mews_customer_id auf dem Guest
//       · keine service_id_<type> gemappt → "Typ X nicht zu Mews konfiguriert"
//   - buildOrderItems mit Gross/Net-Switch
//   - addOrder → OrderId
//
// Caller (api/bookings/update-status) muss in try/catch wrappen + Erfolg/Fehler
// in bookings.mews_order_id / mews_push_error / mews_push_attempted_at schreiben.

import { createSupabaseServiceRoleInstance } from '../auth';
import { getMewsClientForHotel } from './factory';
import type { MewsOrderItem, MewsAddOrderParams } from './client';

// Fallback-Preise wenn lookup fehlschlägt (für Phase 3 Bootstrap — sobald
// Admin-UI für Preise da ist, werden diese aus DB überschrieben).
const DEFAULT_BREAKFAST_PRICE_CENTS = 1500;
const DEFAULT_CONFERENCE_PRICE_CENTS_PER_HOUR = 5000;
const DEFAULT_SERVICE_PRICE_CENTS = 2000;

export type PushSkipReason =
  | 'no_integration'
  | 'pfad_c_plus_not_implemented'
  | 'no_mews_reservation'
  | 'no_mews_customer'
  | 'no_service_id_for_type'
  | 'no_default_tax_code'
  | 'no_default_tax_rate'
  | 'unknown_pricing_mode';

export class PushSkipped extends Error {
  constructor(public readonly reason: PushSkipReason, message: string) {
    super(message);
    this.name = 'PushSkipped';
  }
}

export async function loadHotelMewsIntegration(hotelId: string) {
  const supabase = createSupabaseServiceRoleInstance();
  const { data, error } = await supabase
    .from('mews_integrations')
    .select(`
      hotel_id, enterprise_id, environment, access_token_encrypted,
      default_currency, default_tax_code, default_tax_rate, pricing_mode,
      service_id_breakfast, service_id_service, service_id_conference,
      pricing_source
    `)
    .eq('hotel_id', hotelId)
    .maybeSingle();
  if (error) {
    console.error('[mews/orders] loadHotelMewsIntegration error:', error);
    return null;
  }
  return data;
}

export async function loadBookingWithJoins(bookingId: string) {
  const supabase = createSupabaseServiceRoleInstance();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, type, status, details, hotel_id, created_at,
      stay:stays(
        id, mews_reservation_id, check_in, check_out, guest_id,
        guests(mews_customer_id, first_name, last_name)
      )
    `)
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    console.error('[mews/orders] loadBookingWithJoins error:', error);
    return null;
  }
  return data;
}

async function loadHotelSettings(hotelId: string) {
  const supabase = createSupabaseServiceRoleInstance();
  const { data } = await supabase
    .from('hotel_settings')
    .select('conference_rooms, service_items')
    .eq('hotel_id', hotelId)
    .maybeSingle();
  return data;
}

function pickServiceId(integration: any, type: string): string | null {
  switch (type) {
    case 'breakfast':  return integration.service_id_breakfast ?? null;
    case 'service':    return integration.service_id_service ?? null;
    case 'conference': return integration.service_id_conference ?? null;
    default:           return null;
  }
}

/**
 * Baut die Items für orders/add anhand booking.type + pricing_mode.
 *
 * Gross-Pricing: Brutto-Preis aus unserer DB (price_cents) wird 1:1 als
 *   UnitAmount.GrossValue gepushed — Mews rechnet die Steuer rückwärts.
 * Net-Pricing: out-of-scope für Sprint C (deutsche Hotels später).
 *   Wir würden den Net-Wert aus brutto/(1+rate) berechnen müssen, wofür
 *   wir den TaxRate.Value live nachladen müssten — Backlog.
 */
export function buildOrderItems(
  booking: any,
  integration: any,
  hotelSettings?: { conference_rooms?: any[]; service_items?: any[] } | null,
): MewsOrderItem[] {
  const Currency: string = integration.default_currency ?? 'GBP';
  const taxCode: string | null = integration.default_tax_code ?? null;
  if (!taxCode) {
    throw new PushSkipped('no_default_tax_code', 'mews_integrations.default_tax_code ist NULL');
  }
  const TaxCodes = [taxCode];
  const pricingMode: string | null = integration.pricing_mode ?? null;

  const centsToValue = (cents: number) => Math.round(cents) / 100;
  const makeUnitAmount = (cents: number) => {
    const grossValue = centsToValue(cents);
    if (pricingMode === 'Gross') {
      return { Currency, GrossValue: grossValue, TaxCodes } as const;
    }
    if (pricingMode === 'Net') {
      // DB hält Brutto-Preis (`price_cents` = was der Gast bezahlt). Net-Hotels
      // pushen aber NetValue → wir rechnen rückwärts: Net = Gross / (1 + Rate).
      // Mews rechnet die Steuer dann auf den Net-Wert drauf — Endbetrag muss
      // wieder dem Brutto-Preis entsprechen (Toleranz 1 Cent durch Rundung).
      const rate = Number(integration.default_tax_rate);
      if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
        throw new PushSkipped(
          'no_default_tax_rate',
          `mews_integrations.default_tax_rate fehlt oder ungültig (= ${JSON.stringify(integration.default_tax_rate)}). Setze den Tax-Code in /admin/pms — der Rate wird dann automatisch aus taxations/getAll geholt.`,
        );
      }
      const netValue = Math.round((grossValue / (1 + rate)) * 100) / 100;
      return { Currency, NetValue: netValue, TaxCodes } as const;
    }
    throw new PushSkipped(
      'unknown_pricing_mode',
      `mews_integrations.pricing_mode = ${JSON.stringify(pricingMode)} — erwartet "Gross" oder "Net"`,
    );
  };

  switch (booking.type) {
    case 'breakfast': {
      const details = booking.details ?? {};
      // TODO Sprint-D: Hotel-spezifischer Preis aus breakfast_items pro Item-ID.
      // Aktuell ein zusammengefasstes Item mit Fallback-Default.
      return [{
        Name: 'Frühstück',
        UnitCount: details.people ?? 1,
        UnitAmount: makeUnitAmount(DEFAULT_BREAKFAST_PRICE_CENTS),
      }];
    }

    case 'conference': {
      const details = booking.details ?? {};
      const room = hotelSettings?.conference_rooms?.find(r => r.id === details.room_id);
      const pricePerHour = room?.price_cents_per_hour ?? DEFAULT_CONFERENCE_PRICE_CENTS_PER_HOUR;
      return [{
        Name: `Konferenzraum: ${details.room_name ?? room?.name_de ?? 'unbekannt'}`,
        UnitCount: details.duration_hours ?? 1,
        UnitAmount: makeUnitAmount(pricePerHour),
      }];
    }

    case 'service': {
      const details = booking.details ?? {};
      const item = hotelSettings?.service_items?.find(i => i.id === details.item_id);
      const price = item?.price_cents ?? DEFAULT_SERVICE_PRICE_CENTS;
      return [{
        Name: details.item_name ?? item?.name_de ?? 'Service',
        UnitCount: 1,
        UnitAmount: makeUnitAmount(price),
      }];
    }

    default:
      throw new Error(`buildOrderItems: unbekannter booking.type ${booking.type}`);
  }
}

/**
 * Top-Level: pusht eine retaha-Booking als Mews-Order auf das Gast-Konto.
 *
 * Wirft PushSkipped wenn aus konfiguratorischen Gründen nicht gepushed werden
 * kann (kein Mews, kein Mapping, kein TaxCode). Wirft generische Error bei
 * echten Push-Fehlern (Network, Mews-API-4xx). Caller muss beides catchen.
 */
export async function pushBookingToMews(bookingId: string): Promise<{ orderId: string }> {
  const booking = await loadBookingWithJoins(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} nicht gefunden`);

  const integration = await loadHotelMewsIntegration(booking.hotel_id);
  if (!integration) {
    throw new PushSkipped('no_integration', `Hotel ${booking.hotel_id} ohne Mews-Integration`);
  }

  // Toggle-Switch Pfad A vs C+
  if (integration.pricing_source === 'mews') {
    throw new PushSkipped(
      'pfad_c_plus_not_implemented',
      'Pfad C+ (Mews-Products) noch nicht implementiert — Backlog',
    );
  }

  // Stay & Guest mit Mews verknüpft?
  const stay = booking.stay as any;
  if (!stay?.mews_reservation_id) {
    throw new PushSkipped('no_mews_reservation', `Stay ${stay?.id} ohne mews_reservation_id`);
  }
  const guest = stay.guests as any;
  if (!guest?.mews_customer_id) {
    throw new PushSkipped('no_mews_customer', `Guest des Stays ${stay.id} ohne mews_customer_id`);
  }

  // Service-Mapping für diesen Typ?
  const serviceId = pickServiceId(integration, booking.type);
  if (!serviceId) {
    throw new PushSkipped(
      'no_service_id_for_type',
      `Kein Mews-Service für Booking-Typ "${booking.type}" gemappt (mews_integrations.service_id_${booking.type})`,
    );
  }

  // Hotel-Settings für price-lookup
  const hotelSettings = await loadHotelSettings(booking.hotel_id);

  // Items bauen (kann PushSkipped werfen wenn TaxCode/PricingMode fehlt)
  const Items = buildOrderItems(booking, integration, hotelSettings);

  // Mews-Client (decryptet Token + holt clientToken aus ENV)
  const mews = await getMewsClientForHotel(booking.hotel_id);
  if (!mews) {
    throw new Error(`Mews-Client für Hotel ${booking.hotel_id} konnte nicht erstellt werden (Token-Decrypt?)`);
  }

  const params: MewsAddOrderParams = {
    ServiceId: serviceId,
    AccountId: guest.mews_customer_id,
    LinkedReservationId: stay.mews_reservation_id,
    Items,
    Notes: `retaha booking ${booking.id}`,
  };

  const result = await mews.addOrder(params);
  return { orderId: result.OrderId };
}
