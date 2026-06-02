// Sprint 0+1 · Schritt 5 — Initial-Sync (Mews → unsere DB)
//
// Importiert Resources/Reservations/Customers vom Mews Connector API und
// upsertet in rooms/stays/guests. Mapping-Regeln verifiziert via
// inspect:mews (Sprint-5-Briefing).
//
// Reihenfolge wegen FKs:
//   1. Resources → rooms (nur Type='Room')
//   2. Reservations holen (CollidingUtc-Fenster)
//   3. Customers → guests (in Batches via CustomerIds aus Reservations.AccountId)
//   4. Stays mit Verknüpfungen — access_token bei existierenden NIE überschreiben

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getMewsClientForHotel, getMewsClientFromEnv } from './factory';
import type {
  MewsClient,
  MewsResourcesResponse,
} from './client';

const DEFAULT_WINDOW_DAYS = 30;
const BATCH_SIZE = 100;
const INSERT_BATCH = 500;

/**
 * Default-Filter für relevante Reservation-States:
 *   - 'Confirmed' = bestätigte kommende Gäste
 *   - 'Started'   = aktuell eingecheckt (im Haus)
 *   - 'Processed' = abgereist (kurze Zeit relevant für Wallet-Trigger)
 * Ignoriert: Canceled, Inquired, Optional, Requested — für Gast-Frontend irrelevant.
 */
export const DEFAULT_RELEVANT_STATES: ReadonlyArray<string> = ['Confirmed', 'Started', 'Processed'];

export interface SyncOptions {
  /** Zeitfenster für CollidingUtc-Filter in Tagen, default 30. Beim Testen klein halten. */
  windowDays?: number;
  /** Wenn true: nutzt ENV-Demo-Credentials (für ersten Test ohne mews_integrations-Row). */
  useEnvCredentials?: boolean;
  /** State-Filter für Reservations. Default = DEFAULT_RELEVANT_STATES. */
  states?: ReadonlyArray<string>;
}

export interface SyncResult {
  rooms: number;
  reservations: number;
  guests: number;
  skippedNoRoomCategory: number;
  skippedNonCustomerAccount: number;
  skippedNonRelevantState: number;
  durationMs: number;
}

// ============================================================
// Public API
// ============================================================

export async function syncHotelFromMews(
  hotelId: string,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const startMs = Date.now();
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const supabase = createSupabaseServiceRoleInstance();

  const mews = options.useEnvCredentials
    ? getMewsClientFromEnv()
    : await getMewsClientForHotel(hotelId);
  if (!mews) {
    throw new Error(`No Mews integration configured for hotel ${hotelId}`);
  }

  // Hotel-default-language als Fallback für customer.language
  const { data: hotel } = await supabase
    .from('hotels')
    .select('default_language')
    .eq('id', hotelId)
    .maybeSingle();
  const hotelDefaultLang = typeof hotel?.default_language === 'string' ? hotel.default_language : 'de';

  // sync_status = 'syncing' (nur wenn echte Integration-Row existiert)
  if (!options.useEnvCredentials) {
    await supabase
      .from('mews_integrations')
      .update({
        sync_status: 'syncing',
        sync_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('hotel_id', hotelId);
  }

  const relevantStates = options.states ?? DEFAULT_RELEVANT_STATES;

  const stats: SyncResult = {
    rooms: 0,
    reservations: 0,
    guests: 0,
    skippedNoRoomCategory: 0,
    skippedNonCustomerAccount: 0,
    skippedNonRelevantState: 0,
    durationMs: 0,
  };

  try {
    // ============================================================
    // 1. Resources → rooms
    // ============================================================
    const resourcesResp = await mews.getAllResources({
      Extent: {
        Resources: true,
        ResourceCategories: true,
        ResourceCategoryAssignments: true,
        Inactive: false,
      },
      Limitation: { Count: BATCH_SIZE },
    });
    const roomSyncResult = await syncRoomsFromResources(supabase, hotelId, resourcesResp);
    stats.rooms = roomSyncResult.count;
    stats.skippedNoRoomCategory = roomSyncResult.skipped;
    const roomMap = roomSyncResult.roomMap;

    // ============================================================
    // 2. Reservations holen
    // ============================================================
    const now = new Date();
    const future = new Date(now.getTime() + windowDays * 86_400_000);
    const reservationsResp = await mews.getAllReservations({
      CollidingUtc: { StartUtc: now.toISOString(), EndUtc: future.toISOString() },
      Extent: { Reservations: true, Items: true },
      Limitation: { Count: BATCH_SIZE },
    });
    const allReservations = (reservationsResp.Reservations ?? []) as Reservation[];

    // Filter auf relevante States (Default: Confirmed/Started/Processed).
    // Canceled/Inquired/Optional/Requested-Reservations werden gezählt aber nicht synced.
    const reservations: Reservation[] = [];
    for (const r of allReservations) {
      if (typeof r.State === 'string' && relevantStates.includes(r.State)) {
        reservations.push(r);
      } else {
        stats.skippedNonRelevantState++;
      }
    }

    // CustomerIds sammeln (nur aus relevanten Reservations, nur wenn AccountType === 'Customer')
    const customerIdSet = new Set<string>();
    for (const r of reservations) {
      if (r.AccountType === 'Customer' && typeof r.AccountId === 'string') {
        customerIdSet.add(r.AccountId);
      } else if (r.AccountType && r.AccountType !== 'Customer') {
        stats.skippedNonCustomerAccount++;
      }
    }
    const customerIds = [...customerIdSet];

    // ============================================================
    // 3. Customers → guests (Batches)
    // ============================================================
    const guestSyncResult = await syncGuestsFromCustomers(supabase, mews, customerIds, hotelDefaultLang, hotelId);
    stats.guests = guestSyncResult.count;
    const guestMap = guestSyncResult.guestMap;

    // ============================================================
    // 4. Reservations → stays (access_token-protected)
    // ============================================================
    stats.reservations = await syncStaysFromReservations(
      supabase,
      hotelId,
      reservations,
      roomMap,
      guestMap,
    );

    // sync_status = 'idle' + last_sync_at
    if (!options.useEnvCredentials) {
      await supabase
        .from('mews_integrations')
        .update({
          sync_status: 'idle',
          last_sync_at: new Date().toISOString(),
          sync_error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('hotel_id', hotelId);
    }

    // Sprint D Phase 6a — Pre-Arrival-Mail-Trigger nach erfolgreichem Sync.
    // Lazy-Import um Circular-Import-Risiken zu vermeiden + um den Sync-Pfad
    // nicht durch Email-Code zu poluten wenn Hotel keine Mails nutzen will.
    try {
      const { sendPreArrivalInvitesForHotel } = await import('../email/send-pre-arrival-invites');
      const preStats = await sendPreArrivalInvitesForHotel(hotelId);
      if (preStats.found > 0) {
        console.info(`[mews/sync] pre-arrival: ${preStats.sent} sent / ${preStats.skipped} skipped / ${preStats.failed} failed (of ${preStats.found} eligible)`);
      }
    } catch (err) {
      // Best-effort — Sync-Result darf nicht an Pre-Arrival hängen
      console.warn('[mews/sync] pre-arrival trigger failed:', (err as Error).message);
    }

    stats.durationMs = Date.now() - startMs;
    return stats;
  } catch (err) {
    const errorMessage = (err as Error).message;
    if (!options.useEnvCredentials) {
      await supabase
        .from('mews_integrations')
        .update({
          sync_status: 'error',
          sync_error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('hotel_id', hotelId);
    }
    throw err;
  }
}

// ============================================================
// Helpers
// ============================================================

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function generateAccessToken(): string {
  // 24 bytes base64url ≈ 32 Zeichen, URL-safe, ≥20-char-Anforderung erfüllt
  return randomBytes(24).toString('base64url');
}

function normalizeLang(code: unknown, fallback: string): string {
  if (typeof code !== 'string' || code.length === 0) return fallback;
  // 'en-US' → 'en', 'de-DE' → 'de'
  return code.split('-')[0].toLowerCase();
}

// ============================================================
// Sub-Sync — rooms
// ============================================================

interface Resource {
  Id?: string;
  Name?: string;
  IsActive?: boolean;
  ResourceCategoryId?: string;
  CategoryId?: string;
}

interface ResourceCategory {
  Id?: string;
  Type?: string;
  Names?: Record<string, string>;
}

async function syncRoomsFromResources(
  supabase: SupabaseClient,
  hotelId: string,
  resp: MewsResourcesResponse,
): Promise<{ roomMap: Map<string, string>; count: number; skipped: number }> {
  const categoryById = new Map<string, ResourceCategory>();
  for (const cat of (resp.ResourceCategories ?? []) as ResourceCategory[]) {
    if (typeof cat.Id === 'string') categoryById.set(cat.Id, cat);
  }

  // ResourceCategoryAssignments (separate top-level Array in der Response)
  // Form: { Id, IsActive, ResourceId, ResourceCategoryId }
  const categoryByResource = new Map<string, ResourceCategory>();
  const assignments = ((resp as any).ResourceCategoryAssignments ?? []) as Array<{
    ResourceId?: string;
    ResourceCategoryId?: string;
    CategoryId?: string;
    IsActive?: boolean;
  }>;
  for (const a of assignments) {
    if (a.IsActive === false) continue; // inaktive assignments ignorieren
    const categoryId = a.ResourceCategoryId ?? a.CategoryId;
    if (typeof a.ResourceId === 'string' && typeof categoryId === 'string') {
      const cat = categoryById.get(categoryId);
      if (cat) categoryByResource.set(a.ResourceId, cat);
    }
  }

  // Fallback: einige Resources tragen die CategoryId direkt
  for (const r of (resp.Resources ?? []) as Resource[]) {
    if (typeof r.Id !== 'string' || categoryByResource.has(r.Id)) continue;
    const catId = r.ResourceCategoryId ?? r.CategoryId;
    if (typeof catId === 'string') {
      const cat = categoryById.get(catId);
      if (cat) categoryByResource.set(r.Id, cat);
    }
  }

  // Filter auf Type='Room'
  const roomRows: Array<{
    hotel_id: string;
    mews_resource_id: string;
    room_number: string | null;
    room_name: string | null;
    is_active: boolean;
    category: string | null;
  }> = [];
  let skipped = 0;
  for (const r of (resp.Resources ?? []) as Resource[]) {
    if (typeof r.Id !== 'string') continue;
    const cat = categoryByResource.get(r.Id);
    if (!cat || cat.Type !== 'Room') {
      skipped++;
      continue;
    }
    const names = cat.Names ?? {};
    const categoryName = names['en-US'] ?? names['en-GB'] ?? Object.values(names)[0] ?? null;
    roomRows.push({
      hotel_id: hotelId,
      mews_resource_id: r.Id,
      // Mews-Resources haben oft keine echte Room-Number — bewusst NULL
      // (nicht '' — Postgres würde leere Strings als Kollision sehen,
      // NULLs sind in UNIQUE-Indizes distinct).
      room_number: null,
      room_name: r.Name ?? null,
      is_active: r.IsActive ?? true,
      category: categoryName,
    });
  }

  const roomMap = new Map<string, string>();
  if (roomRows.length === 0) return { roomMap, count: 0, skipped };

  const { data, error } = await supabase
    .from('rooms')
    .upsert(roomRows, { onConflict: 'mews_resource_id' })
    .select('id, mews_resource_id');
  if (error) throw new Error(`rooms upsert failed: ${error.message}`);

  for (const row of (data ?? []) as Array<{ id: string; mews_resource_id: string | null }>) {
    if (row.mews_resource_id) roomMap.set(row.mews_resource_id, row.id);
  }
  return { roomMap, count: data?.length ?? 0, skipped };
}

// ============================================================
// Sub-Sync — guests
// ============================================================

interface Customer {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  LanguageCode?: string;
  PreferredLanguageCode?: string;
  Classifications?: string[];
}

async function syncGuestsFromCustomers(
  supabase: SupabaseClient,
  mews: MewsClient,
  customerIds: string[],
  hotelDefaultLang: string,
  hotelId: string,
): Promise<{ guestMap: Map<string, string>; count: number }> {
  const guestMap = new Map<string, string>();
  if (customerIds.length === 0) return { guestMap, count: 0 };

  let totalCount = 0;
  for (const batch of chunk(customerIds, BATCH_SIZE)) {
    const resp = await mews.getCustomers({
      CustomerIds: batch,
      Extent: { Customers: true },
      Limitation: { Count: BATCH_SIZE },
    });
    const customers = (resp.Customers ?? []) as Customer[];
    if (customers.length === 0) continue;

    const upserts = customers
      .filter(c => typeof c.Id === 'string')
      .map(c => ({
        hotel_id: hotelId,
        mews_customer_id: c.Id!,
        first_name: c.FirstName ?? null,
        last_name: c.LastName ?? null,
        email: c.Email ?? null,
        language: normalizeLang(c.LanguageCode ?? c.PreferredLanguageCode, hotelDefaultLang),
        visit_count: Array.isArray(c.Classifications) && c.Classifications.includes('Returning') ? 2 : 1,
      }));

    if (upserts.length === 0) continue;

    const { data, error } = await supabase
      .from('guests')
      .upsert(upserts, { onConflict: 'mews_customer_id' })
      .select('id, mews_customer_id');
    if (error) throw new Error(`guests upsert failed: ${error.message}`);

    for (const row of (data ?? []) as Array<{ id: string; mews_customer_id: string | null }>) {
      if (row.mews_customer_id) guestMap.set(row.mews_customer_id, row.id);
    }
    totalCount += data?.length ?? 0;
  }

  return { guestMap, count: totalCount };
}

// ============================================================
// Sub-Sync — stays (access_token-protected)
// ============================================================

interface Reservation {
  Id?: string;
  AccountId?: string;
  AccountType?: string;
  State?: string;
  StartUtc?: string;
  EndUtc?: string;
  ActualStartUtc?: string | null;
  ActualEndUtc?: string | null;
  AssignedResourceId?: string | null;
  PersonCounts?: Array<{ AgeCategoryId?: string; Count?: number }>;
  [key: string]: unknown;
}

async function syncStaysFromReservations(
  supabase: SupabaseClient,
  hotelId: string,
  reservations: Reservation[],
  roomMap: Map<string, string>,
  guestMap: Map<string, string>,
): Promise<number> {
  if (reservations.length === 0) return 0;

  // 1. Bestehende mews_reservation_ids raussuchen — für access_token-Schutz
  const reservationIds = reservations
    .map(r => r.Id)
    .filter((id): id is string => typeof id === 'string');

  const existingIds = new Set<string>();
  // Batch-Size 100: PostgREST .in() serialisiert IDs als Query-String;
  // bei UUIDs (~37 chars) wird die URL bei 500 IDs ~18 KB groß und
  // überschreitet undici's HTTP-Header-Limit (16 KB) → TypeError: fetch failed.
  for (const batch of chunk(reservationIds, 100)) {
    const { data, error } = await supabase
      .from('stays')
      .select('mews_reservation_id')
      .in('mews_reservation_id', batch);
    if (error) throw new Error(`stays lookup failed: ${error.message}`);
    for (const row of (data ?? []) as Array<{ mews_reservation_id: string | null }>) {
      if (row.mews_reservation_id) existingIds.add(row.mews_reservation_id);
    }
  }

  // 2. Splitten: neue → INSERT, existierende → UPDATE (ohne access_token)
  const newRows: Array<Record<string, unknown>> = [];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const r of reservations) {
    if (typeof r.Id !== 'string') continue;
    const accountId = r.AccountType === 'Customer' && typeof r.AccountId === 'string' ? r.AccountId : null;
    const guestId = accountId ? guestMap.get(accountId) ?? null : null;
    const roomId = typeof r.AssignedResourceId === 'string' ? roomMap.get(r.AssignedResourceId) ?? null : null;
    const personCounts = Array.isArray(r.PersonCounts) ? r.PersonCounts : [];
    const guestCount = personCounts.reduce(
      (sum, pc) => sum + (typeof pc.Count === 'number' ? pc.Count : 0),
      0,
    ) || 1;

    const mewsFields = {
      mews_reservation_id: r.Id,
      mews_customer_id: accountId,
      state: r.State ?? null,
      check_in: r.StartUtc ?? null,
      check_out: r.EndUtc ?? null,
      checked_in_at: r.ActualStartUtc ?? null,
      checked_out_at: r.ActualEndUtc ?? null,
      guest_count: guestCount,
      raw_mews_data: r,
      guest_id: guestId,
      room_id: roomId,
    };

    if (existingIds.has(r.Id)) {
      updates.push({ id: r.Id, data: mewsFields });
    } else {
      newRows.push({
        ...mewsFields,
        hotel_id: hotelId,
        access_token: generateAccessToken(),
        is_active: true,
      });
    }
  }

  let processed = 0;
  const insertedStays: Array<{ id: string; hotel_id: string; guest_id: string | null }> = [];

  // 3. INSERT (Batches)
  for (const batch of chunk(newRows, INSERT_BATCH)) {
    const { data, error } = await supabase.from('stays').insert(batch).select('id, hotel_id, guest_id');
    if (error) throw new Error(`stays insert failed: ${error.message}`);
    processed += data?.length ?? 0;
    insertedStays.push(...(data ?? []) as any);
  }

  // 3.5. Sprint Wallet Modul E — Email-Match + Wiederkehrer-Linking +
  // welcome-Trigger. Best-Effort: pro Stay isoliert, killt nicht den Sync-Run.
  if (insertedStays.length > 0) {
    try {
      const { linkReturningGuests } = await import('../wallet/returning-guest');
      await linkReturningGuests(insertedStays);
    } catch (err) {
      console.warn('[mews-sync] returning-guest-linking failed (non-fatal):', (err as Error).message);
    }
  }

  // 4. UPDATE (einzeln — access_token bleibt unangetastet)
  for (const { id, data } of updates) {
    const { error } = await supabase
      .from('stays')
      .update(data)
      .eq('mews_reservation_id', id);
    if (error) throw new Error(`stays update failed for ${id}: ${error.message}`);
    processed++;
  }

  return processed;
}
