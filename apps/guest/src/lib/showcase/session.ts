// Sprint H · Group 2 — Showcase-Session-Lib
//
// Showcase = Demo-Mode für Hotelier-Walkthroughs. Verhält sich wie ein
// echter Stay, aber Bookings/Eve-Actions werden NICHT an Mews gepushed.
//
// Token-Format: 'showcase_<32-hex>' (Prefix erlaubt 0-Cost Differenzierung
// im Stay-Token-Resolver — ohne DB-Hit).

import { randomBytes } from 'node:crypto';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

export const SHOWCASE_TOKEN_PREFIX = 'showcase_';
const DEFAULT_TTL_DAYS = 14;

export function isShowcaseToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(SHOWCASE_TOKEN_PREFIX);
}

function generateShowcaseToken(): string {
  return SHOWCASE_TOKEN_PREFIX + randomBytes(16).toString('hex');
}

export interface DemoItem {
  label: string;
  amount_cents: number;
}

export type ShowcasePreset = 'pre_arrival' | 'in_house' | 'checkout_day' | 'checked_out';

export interface DemoData {
  guest_first_name: string;
  guest_last_name: string;
  room_number: string;
  room_name: string;
  // Configurator fields
  guest_email?: string;
  preset?: ShowcasePreset;
  check_in?: string;    // ISO datetime
  check_out?: string;   // ISO datetime
  balance_cents?: number;
  currency?: string;
  items?: DemoItem[];
  // Set by /api/checkout/complete for demo sessions — triggers success screen on reload
  checked_out_at_sim?: string;
}

/** Single source of truth: ist ein stays-Row ein Demo-Stay?
 *  Demo ⟺ mews_reservation_id IS NULL + _retaha_sim in raw_mews_data.
 *  Für Showcase-Sessions (kein stays-Row) → isDemoSession() verwenden. */
export function isDemoStay(stay: { mews_reservation_id?: string | null; raw_mews_data?: unknown }): boolean {
  return !stay.mews_reservation_id && !!(stay.raw_mews_data as any)?._retaha_sim;
}

/** Single source of truth: is this a demo/showcase session (cookie-based)? */
export function isDemoSession(session: { is_showcase?: boolean }): boolean {
  return session.is_showcase === true;
}

export interface ShowcaseSession {
  id: string;
  hotel_id: string;
  token: string;
  demo_data: DemoData;
  expires_at: string;
  is_active: boolean;
  reset_count: number;
  last_reset_at: string | null;
  created_at: string;
  created_by: string | null;
}

export async function createShowcaseSession(args: {
  hotelId: string;
  createdBy: string;
  ttlDays?: number;
  demoData?: Partial<DemoData>;
}): Promise<ShowcaseSession | { error: string }> {
  const sb = createSupabaseServiceRoleInstance();
  const ttl = args.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 86_400_000).toISOString();

  const insertPayload: any = {
    hotel_id: args.hotelId,
    token: generateShowcaseToken(),
    created_by: args.createdBy,
    expires_at: expiresAt,
  };
  if (args.demoData) {
    // Merge mit Defaults via DB-default JSONB nicht trivial — wir setzen
    // demo_data explizit wenn Override kommt.
    insertPayload.demo_data = {
      guest_first_name: 'Anna',
      guest_last_name: 'Demo',
      room_number: '101',
      room_name: 'Demo-Suite',
      ...args.demoData,
    };
  }

  const { data, error } = await sb.from('showcase_sessions')
    .insert(insertPayload)
    .select('*')
    .single();
  if (error || !data) return { error: error?.message || 'insert_failed' };
  return data as ShowcaseSession;
}

export async function findShowcaseSessionByToken(token: string): Promise<ShowcaseSession | null> {
  if (!isShowcaseToken(token)) return null;
  const sb = createSupabaseServiceRoleInstance();
  const { data } = await sb.from('showcase_sessions')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return (data as ShowcaseSession | null) ?? null;
}

export async function listShowcaseSessions(hotelId: string): Promise<ShowcaseSession[]> {
  const sb = createSupabaseServiceRoleInstance();
  const { data } = await sb.from('showcase_sessions')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as ShowcaseSession[];
}

/**
 * Reset: löscht alle Showcase-Bookings + Showcase-Chat-Messages via dedizierte
 * showcase_session_id-Spalte (Migration 20260617).
 */
export async function resetShowcaseSession(sessionId: string, hotelId?: string): Promise<{ ok: boolean; deleted: { bookings: number; chat: number }; error?: string }> {
  const sb = createSupabaseServiceRoleInstance();

  // Scope to hotel if provided (extra guard)
  if (hotelId) {
    const { data: check } = await sb.from('showcase_sessions').select('id').eq('id', sessionId).eq('hotel_id', hotelId).maybeSingle();
    if (!check) return { ok: false, deleted: { bookings: 0, chat: 0 }, error: 'session_not_found' };
  }

  const [bRes, cRes, wRes] = await Promise.all([
    sb.from('bookings').delete().eq('showcase_session_id', sessionId).select('id'),
    sb.from('chat_messages').delete().eq('showcase_session_id', sessionId).select('id'),
    sb.from('wallet_passes').delete().eq('showcase_session_id', sessionId).select('id'),
  ]);
  const { data: latest } = await sb.from('showcase_sessions').select('reset_count').eq('id', sessionId).single();
  await sb.from('showcase_sessions').update({
    reset_count: (latest?.reset_count ?? 0) + 1,
    last_reset_at: new Date().toISOString(),
  }).eq('id', sessionId);
  return {
    ok: true,
    deleted: { bookings: bRes.data?.length ?? 0, chat: cRes.data?.length ?? 0, wallet_passes: wRes.data?.length ?? 0 },
  };
}

/**
 * Hard-Delete: entfernt die showcase_sessions-Zeile dauerhaft. Die FK-Referenzen
 * bookings.showcase_session_id, chat_messages.showcase_session_id und
 * wallet_passes.showcase_session_id sind ON DELETE CASCADE → die abhängigen
 * Demo-Daten werden automatisch mitgelöscht (kein manuelles Aufräumen nötig,
 * kein Orphan-Risiko, kein FK-Crash). Hotel-skopiert: löscht nur Sessions des
 * eigenen Hotels.
 */
export async function deleteShowcaseSession(sessionId: string, hotelId: string): Promise<{ ok?: boolean; error?: string }> {
  const sb = createSupabaseServiceRoleInstance();

  // Scope-Guard: Session muss zum Hotel des eingeloggten Hoteliers gehören.
  const { data: check } = await sb.from('showcase_sessions')
    .select('id').eq('id', sessionId).eq('hotel_id', hotelId).maybeSingle();
  if (!check) return { error: 'session_not_found' };

  // Row löschen → ON DELETE CASCADE räumt bookings/chat_messages/wallet_passes.
  const { error } = await sb.from('showcase_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('hotel_id', hotelId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateShowcaseSession(args: {
  sessionId: string;
  hotelId: string;
  demoData: Partial<DemoData>;
}): Promise<ShowcaseSession | { error: string }> {
  const sb = createSupabaseServiceRoleInstance();

  const { data: current } = await sb.from('showcase_sessions')
    .select('demo_data')
    .eq('id', args.sessionId)
    .eq('hotel_id', args.hotelId)
    .eq('is_active', true)
    .maybeSingle();

  if (!current) return { error: 'session_not_found' };

  const merged = { ...(current.demo_data ?? {}), ...args.demoData };

  const { data, error } = await sb.from('showcase_sessions')
    .update({ demo_data: merged })
    .eq('id', args.sessionId)
    .eq('hotel_id', args.hotelId)
    .select('*')
    .single();

  if (error || !data) return { error: error?.message || 'update_failed' };
  return data as ShowcaseSession;
}

/**
 * Single Source of Truth fuer Demo-Stay-Daten: leitet check_in/check_out aus dem
 * Preset relativ zu `now` ab. Bewusst KEINE gespeicherten Absolut-Daten — die
 * driften (relativ gemeinte Zustaende, absolut gespeichert) und uebersteuern den
 * gewaehlten Preset. Akzeptiert auch die Live-Preview-Aliase arrival/departure.
 */
export function resolveDemoCheckDates(
  preset: string | null | undefined,
  now: Date = new Date(),
): { checkIn: Date; checkOut: Date } {
  const p = preset === 'arrival' ? 'pre_arrival'
          : preset === 'departure' ? 'checkout_day'
          : (preset ?? 'in_house');
  let checkIn: Date, checkOut: Date;
  if (p === 'pre_arrival') {
    checkIn  = new Date(now);     checkIn.setUTCDate(checkIn.getUTCDate() + 3);    checkIn.setUTCHours(14, 0, 0, 0);
    checkOut = new Date(checkIn); checkOut.setUTCDate(checkOut.getUTCDate() + 2);  checkOut.setUTCHours(11, 0, 0, 0);
  } else if (p === 'checkout_day') {
    checkIn  = new Date(now); checkIn.setUTCDate(checkIn.getUTCDate() - 2); checkIn.setUTCHours(14, 0, 0, 0);
    checkOut = new Date(now); checkOut.setUTCHours(23, 59, 59, 0);  // Abreise heute, Checkout noch offen
  } else if (p === 'checked_out') {
    checkIn  = new Date(now); checkIn.setUTCDate(checkIn.getUTCDate() - 3); checkIn.setUTCHours(14, 0, 0, 0);
    checkOut = new Date(now); checkOut.setUTCDate(checkOut.getUTCDate() - 1); checkOut.setUTCHours(11, 0, 0, 0);
  } else {
    // in_house
    checkIn  = new Date(now); checkIn.setUTCDate(checkIn.getUTCDate() - 1); checkIn.setUTCHours(14, 0, 0, 0);
    checkOut = new Date(now); checkOut.setUTCDate(checkOut.getUTCDate() + 1); checkOut.setUTCHours(11, 0, 0, 0);
  }
  return { checkIn, checkOut };
}
