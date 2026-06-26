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

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getMewsClientForHotel } from './factory';
import type { MewsOrderItem, MewsAddOrderParams } from './client';

// Fallback-Preise wenn lookup fehlschlägt (für Phase 3 Bootstrap — sobald
// Admin-UI für Preise da ist, werden diese aus DB überschrieben).
const DEFAULT_BREAKFAST_PRICE_CENTS = 1500;
const DEFAULT_SERVICE_PRICE_CENTS = 2000;

export type PushSkipReason =
  | 'no_integration'
  | 'pfad_c_plus_not_implemented'
  | 'no_mews_reservation'
  | 'no_mews_customer'
  | 'no_service_id_for_type'
  | 'no_default_tax_code'
  | 'no_default_tax_rate'
  | 'unknown_pricing_mode'
  | 'charge_disabled_for_type';

/**
 * UX-017 P3 — Hotelier hat in /admin/pms den Charge-Toggle pro Booking-Type.
 * Mapping booking.type → mews_integrations.{type}_charge_enabled column.
 * Wenn explizit false → PushSkipped. Wenn null/undefined → behandelt als true
 * (Backward-Compat, falls Migration noch nicht durchgelaufen — NOT NULL DEFAULT
 * sollte das aber sowieso verhindern).
 */
function isChargeDisabledForType(integration: any, bookingType: string): boolean {
  const col = `${bookingType}_charge_enabled`;
  return integration[col] === false;
}

export class PushSkipped extends Error {
  constructor(public readonly reason: PushSkipReason, message: string) {
    super(message);
    this.name = 'PushSkipped';
  }
}

// Sprint E1 Phase 4 — Cancel-Symmetrie.
export type CancelSkipReason =
  | 'no_integration'
  | 'no_mews_order_id'
  | 'already_cancelled'
  | 'no_order_items_found'
  | 'editable_history_expired';

export class CancelSkipped extends Error {
  constructor(public readonly reason: CancelSkipReason, message: string) {
    super(message);
    this.name = 'CancelSkipped';
  }
}

// Mews-Doku liefert keinen dezidierten Error-Code wenn die Editable-History
// abgelaufen ist (2-7 Tage je nach Enterprise-Config). Wir matchen die
// Response-Message konservativ — bei Nicht-Match fällt der Fehler auf generic
// 'error' zurück (kein False-Positive). Wenn wir den exakten Wortlaut im
// Pilot beobachten, Patterns verschärfen.
const EDITABLE_HISTORY_PATTERNS: RegExp[] = [
  /editable\s+history/i,
  /outside\s+(of\s+)?editable/i,
  /not\s+editable/i,
  /history\s+window/i,
];

function isEditableHistoryError(message: string): boolean {
  return EDITABLE_HISTORY_PATTERNS.some(p => p.test(message));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadHotelMewsIntegration(hotelId: string) {
  const supabase = createSupabaseServiceRoleInstance();
  const { data, error } = await supabase
    .from('mews_integrations')
    .select(`
      hotel_id, enterprise_id, environment, access_token_encrypted,
      default_currency, default_tax_code, default_tax_rate, pricing_mode,
      service_id_breakfast, service_id_service,
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
    .select('service_items')
    .eq('hotel_id', hotelId)
    .maybeSingle();
  return data;
}

interface BreakfastItemRow {
  id: string;
  name_i18n: { de?: string; en?: string; fr?: string; es?: string } | null;
  price_cents: number | null;
  display_order: number | null;
}

/**
 * UX-017 P1 — Echter Preis-Lookup für breakfast bookings.
 *
 * Lädt entweder spezifische Items (Multi-Item-Schema, zukünftig) oder
 * das "default item" (aktuelles Pauschal-Schema: 1 Tisch für N Personen).
 *
 * Pauschal-Logik: nimmt das erste aktive breakfast_item mit display_order ASC
 * als "Standard-Frühstück-Pauschale". Hotelier kann via /admin/breakfast die
 * Reihenfolge + Preise steuern.
 *
 * Returns leere Array wenn keine Items für Hotel — Caller fällt auf Fallback-
 * Konstante zurück.
 */
async function loadBreakfastItems(
  hotelId: string,
  itemIds?: string[] | null,
): Promise<BreakfastItemRow[]> {
  const supabase = createSupabaseServiceRoleInstance();
  let query = supabase
    .from('breakfast_items')
    .select('id, name_i18n, price_cents, display_order')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);
  if (itemIds && itemIds.length > 0) {
    query = query.in('id', itemIds);
  } else {
    // Pauschal-Pfad: nimm nur das erste aktive Item als Standard-Frühstück
    query = query.order('display_order', { ascending: true, nullsFirst: false }).limit(1);
  }
  const { data, error } = await query;
  if (error) {
    console.warn('[mews/orders] loadBreakfastItems failed:', error.message);
    return [];
  }
  return (data ?? []) as BreakfastItemRow[];
}

function pickBreakfastName(item: BreakfastItemRow | undefined, fallback = 'Frühstück'): string {
  if (!item?.name_i18n) return fallback;
  return item.name_i18n.de ?? item.name_i18n.en ?? Object.values(item.name_i18n)[0] ?? fallback;
}

function pickServiceId(integration: any, type: string): string | null {
  switch (type) {
    case 'breakfast': return integration.service_id_breakfast ?? null;
    case 'service':   return integration.service_id_service ?? null;
    default:          return null;
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
export async function buildOrderItems(
  booking: any,
  integration: any,
  hotelSettings?: { service_items?: any[] } | null,
): Promise<MewsOrderItem[]> {
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

      // UX-017 P1 — Hybrid-Schema:
      //   (a) Multi-Item (zukünftig): details.items = [{id, quantity?, name?}]
      //   (b) Pauschal (aktuell):     details = {people, date, time, ...}
      //
      // Beide Pfade lookupen breakfast_items.price_cents — Fallback nur wenn
      // weder Multi-Item-IDs gefunden noch ein aktives Default-Item existiert.

      // (a) Multi-Item-Schema
      if (Array.isArray(details.items) && details.items.length > 0) {
        const itemIds = details.items
          .map((it: any) => it?.id)
          .filter((id: any) => typeof id === 'string') as string[];
        const dbItems = itemIds.length > 0
          ? await loadBreakfastItems(booking.hotel_id, itemIds)
          : [];
        return details.items.map((orderItem: any) => {
          const dbItem = dbItems.find(b => b.id === orderItem.id);
          const price =
            dbItem?.price_cents && dbItem.price_cents > 0
              ? dbItem.price_cents
              : DEFAULT_BREAKFAST_PRICE_CENTS;
          return {
            Name: pickBreakfastName(dbItem, orderItem.name ?? 'Frühstück'),
            UnitCount: typeof orderItem.quantity === 'number' && orderItem.quantity > 0
              ? orderItem.quantity
              : 1,
            UnitAmount: makeUnitAmount(price),
          };
        });
      }

      // (b) Pauschal-Pfad: Standard-Frühstück-Item (display_order=0)
      const people = typeof details.people === 'number' && details.people > 0
        ? details.people
        : 1;
      const defaultItems = await loadBreakfastItems(booking.hotel_id, null);
      const defaultItem = defaultItems[0];
      const price =
        defaultItem?.price_cents && defaultItem.price_cents > 0
          ? defaultItem.price_cents
          : DEFAULT_BREAKFAST_PRICE_CENTS;
      return [{
        Name: pickBreakfastName(defaultItem),
        UnitCount: people,
        UnitAmount: makeUnitAmount(price),
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

  // UX-017 P3 — Per-Type Charge-Toggle aus /admin/pms
  if (isChargeDisabledForType(integration, booking.type)) {
    throw new PushSkipped(
      'charge_disabled_for_type',
      `charge for booking type "${booking.type}" is disabled for this hotel (admin/pms config)`,
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
  const Items = await buildOrderItems(booking, integration, hotelSettings);

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

/**
 * Sprint E1 Phase 4 — Symmetrie zu pushBookingToMews().
 *
 * Cancelt die OrderItems des Mews-Orders der zur Booking gehört
 * (bookings.mews_order_id). 2-Step weil orders/add keine OrderItemIds in
 * der Response liefert:
 *   1. orderItems/getAll mit ServiceOrderIds=[mews_order_id] → Item-IDs
 *   2. orderItems/cancel mit den IDs (max 10 pro Call, ggf. chunked)
 *
 * Wirft CancelSkipped wenn nichts zu cancellen ist:
 *   · no_integration / no_mews_order_id / already_cancelled (Pre-Checks)
 *   · no_order_items_found (Mews kennt den Order nicht oder schon storniert)
 *   · editable_history_expired (Mews-API-Fehler matched bekanntes Pattern)
 * Wirft generische Error bei echten Mews-API-Fehlern.
 *
 * Returns OrderItemIds die tatsächlich gecancelt wurden (Bookkeeping).
 */
export async function cancelBookingInMews(bookingId: string): Promise<{ orderId: string; itemIds: string[] }> {
  const supabase = createSupabaseServiceRoleInstance();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, hotel_id, mews_order_id, mews_cancelled_at')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    console.error('[mews/orders] cancelBookingInMews load error:', error);
    throw new Error(`Booking ${bookingId} konnte nicht geladen werden: ${error.message}`);
  }
  if (!booking) throw new Error(`Booking ${bookingId} nicht gefunden`);

  if (!booking.mews_order_id) {
    throw new CancelSkipped('no_mews_order_id', `Booking ${bookingId} hat keine mews_order_id (Push lief nicht oder Pfad C+/skip)`);
  }
  if (booking.mews_cancelled_at) {
    throw new CancelSkipped('already_cancelled', `Booking ${bookingId} (Order ${booking.mews_order_id}) wurde bereits am ${booking.mews_cancelled_at} gecancelt`);
  }

  const integration = await loadHotelMewsIntegration(booking.hotel_id);
  if (!integration) {
    throw new CancelSkipped('no_integration', `Hotel ${booking.hotel_id} ohne Mews-Integration`);
  }

  const mews = await getMewsClientForHotel(booking.hotel_id);
  if (!mews) {
    throw new Error(`Mews-Client für Hotel ${booking.hotel_id} konnte nicht erstellt werden (Token-Decrypt?)`);
  }

  // Step 1: OrderItem-IDs auflösen
  const lookup = await mews.getOrderItems({
    ServiceOrderIds: [booking.mews_order_id],
    Limitation: { Count: 100 },
  });
  const items = lookup.OrderItems ?? [];
  // Defensive: nicht alle Items haben evtl. Status "Open" — wir cancellen
  // pragmatisch alle die nicht bereits 'Canceled' sind (Mews-Schreibweise).
  const cancellable = items.filter(it => {
    const state = (it.State ?? '').toString();
    return state !== 'Canceled' && state !== 'Cancelled';
  });
  const itemIds = cancellable.map(it => it.Id).filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (itemIds.length === 0) {
    throw new CancelSkipped(
      'no_order_items_found',
      `Order ${booking.mews_order_id} hat keine cancelbaren Items in Mews (Order existiert nicht oder ist schon komplett storniert). Geladen: ${items.length} Items.`,
    );
  }

  // Step 2: Cancel in Chunks à max 10 IDs
  try {
    for (const batch of chunk(itemIds, 10)) {
      await mews.cancelOrderItems({ OrderItemIds: batch });
    }
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    // Full message immer loggen — Pattern-Verfeinerung im Pilot
    console.warn('[mews/cancel] full error:', message);
    if (isEditableHistoryError(message)) {
      throw new CancelSkipped(
        'editable_history_expired',
        `Editable-History-Window für Order ${booking.mews_order_id} abgelaufen — Mews lehnt Cancel ab: ${message}`,
      );
    }
    throw err;
  }

  return { orderId: booking.mews_order_id, itemIds };
}
