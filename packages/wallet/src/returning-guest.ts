// Sprint Wallet · Modul E — Wiederkehrer-Helpers
//
// Zwei Verknüpfungs-Pfade Stay ↔ Wallet-Pass:
//
//   (a) Mews-Sync nach neuem Stay-Insert: Email-Match findet existierenden Pass
//       → wallet_pass.visit_count++ + last_visit_at=NOW + stay.wallet_pass_id
//       → Google Wallet Pass-Object updaten + welcome-Trigger
//
//   (b) Wallet-Click Deep-Link: Gast öffnet Pass im Wallet → /g/wallet-open
//       → findActiveStayForPass → bei Treffer linken + welcome-Trigger
//
// Idempotenz für welcome wird im sendStayPush-Insert-Lock erzwungen
// (UNIQUE-Index aus Modul D) — beide Pfade dürfen gleichzeitig feuern.
//
// Email-Match ist case-insensitive (LOWER).

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { updatePassObject } from './google';
import { sendStayPush } from './stay-push';
import { asLanguageCode } from '@retaha/i18n';

export interface MatchedPass {
  id: string;
  hotel_id: string;
  visit_count: number;
  first_visit_at: string;
  last_visit_at: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  state: 'active' | 'opted_out' | 'expired';
  google_object_id: string | null;
}

/** Case-insensitive Email-Match in einem Hotel. Returnt null wenn nichts. */
export async function findWalletPassByEmail(
  hotelId: string,
  email: string,
): Promise<MatchedPass | null> {
  if (!email) return null;
  const sb = createSupabaseServiceRoleInstance();
  const { data } = await sb
    .from('wallet_passes')
    .select('id, hotel_id, visit_count, first_visit_at, last_visit_at, guest_first_name, guest_last_name, state, google_object_id')
    .eq('hotel_id', hotelId)
    .ilike('guest_email', email)  // case-insensitive
    .maybeSingle();
  return (data ?? null) as MatchedPass | null;
}

interface StayInsertInfo {
  id: string;
  hotel_id: string;
  guest_id: string | null;
}

/**
 * Nach Mews-Sync: jeder neue Stay wird gegen Wallet-Pässe gematcht.
 * Best-Effort: jeder Match crasht isoliert (try/catch pro Stay).
 *
 * Return: Anzahl der gefundenen Wiederkehrer (für Logging).
 */
export async function linkReturningGuests(stays: StayInsertInfo[]): Promise<number> {
  if (stays.length === 0) return 0;
  const sb = createSupabaseServiceRoleInstance();

  // Guest-Emails bulk laden
  const guestIds = Array.from(new Set(stays.map(s => s.guest_id).filter((g): g is string => !!g)));
  if (guestIds.length === 0) return 0;
  const { data: guests } = await sb
    .from('guests')
    .select('id, email, language')
    .in('id', guestIds);
  const guestMap = new Map((guests ?? []).map((g: any) => [g.id, g]));

  let linked = 0;

  for (const stay of stays) {
    try {
      if (!stay.guest_id) continue;
      const guest = guestMap.get(stay.guest_id);
      if (!guest?.email) continue;

      const matched = await findWalletPassByEmail(stay.hotel_id, guest.email);
      if (!matched) continue;

      // → Wiederkehrer!
      const newVisitCount = (matched.visit_count ?? 1) + 1;
      const nowIso = new Date().toISOString();

      // 1. wallet_pass updaten
      const { error: passErr } = await sb
        .from('wallet_passes')
        .update({
          visit_count: newVisitCount,
          last_visit_at: nowIso,
        })
        .eq('id', matched.id);
      if (passErr) {
        console.warn(`[returning-guest] pass-update failed for ${matched.id.slice(0,8)}:`, passErr.message);
        continue;
      }

      // 2. Stay verknüpfen
      const { error: linkErr } = await sb
        .from('stays')
        .update({ wallet_pass_id: matched.id })
        .eq('id', stay.id);
      if (linkErr) console.warn(`[returning-guest] stay-link failed for ${stay.id.slice(0,8)}:`, linkErr.message);
      else linked++;

      // 3. Google Wallet Pass-Object updaten (zeigt neue visit_count im Wallet)
      // Best-Effort: bei Failure läuft welcome trotzdem
      const lang = asLanguageCode(guest.language);
      const { data: hotel } = await sb.from('hotels').select('name').eq('id', matched.hotel_id).maybeSingle();
      try {
        await updatePassObject({
          walletPassUuid: matched.id,
          hotelId: matched.hotel_id,
          hotelName: hotel?.name || 'Hotel',
          guestFirstName: matched.guest_first_name,
          guestLastName: matched.guest_last_name,
          visitCount: newVisitCount,
          firstVisitAt: new Date(matched.first_visit_at),
          lastVisitAt: new Date(nowIso),
          defaultLang: lang,
        });
      } catch (err) {
        console.warn(`[returning-guest] google-update non-fatal:`, (err as Error).message);
      }

      // 4. welcome-Trigger (Idempotenz via UNIQUE-Index aus Modul D)
      await sendStayPush(stay.id, 'welcome');
    } catch (err) {
      console.warn(`[returning-guest] stay ${stay.id.slice(0,8)} crashed (non-fatal):`, (err as Error).message);
    }
  }

  console.info(`[returning-guest] mews-sync: ${linked} Wiederkehrer von ${stays.length} neuen Stays`);
  return linked;
}

/** Findet einen aktiv-laufenden Stay für einen Pass (für Deep-Link + first-open). */
export async function findActiveStayForPass(walletPassId: string): Promise<{
  id: string; hotel_id: string; access_token: string;
} | null> {
  const sb = createSupabaseServiceRoleInstance();
  const { data: pass } = await sb
    .from('wallet_passes')
    .select('hotel_id, guest_email')
    .eq('id', walletPassId)
    .maybeSingle();
  if (!pass) return null;

  // Aktiver Stay: check_in <= NOW < check_out, gleiche email + hotel
  if (!pass.guest_email) return null;
  const nowIso = new Date().toISOString();

  // Email-Filter direkt im JOIN (PostgREST nested filter via inner join)
  // — sonst würde LIMIT bei vielen Stays unseren Treffer wegfiltern
  const { data: stays } = await sb
    .from('stays')
    .select('id, hotel_id, access_token, check_in, check_out, guests!inner(email)')
    .eq('hotel_id', pass.hotel_id)
    .ilike('guests.email', pass.guest_email)
    .lte('check_in', nowIso)
    .gt('check_out', nowIso)
    .eq('is_active', true)
    .order('check_in', { ascending: false })
    .limit(5);

  const first = (stays ?? [])[0];
  if (!first) return null;
  return { id: first.id, hotel_id: first.hotel_id, access_token: first.access_token };
}

/** Stay an Pass binden (Deep-Link-Pfad + first-open-Webhook). Idempotent. */
export async function linkStayToPass(stayId: string, walletPassId: string): Promise<void> {
  const sb = createSupabaseServiceRoleInstance();
  await sb.from('stays').update({ wallet_pass_id: walletPassId }).eq('id', stayId).is('wallet_pass_id', null);
}
