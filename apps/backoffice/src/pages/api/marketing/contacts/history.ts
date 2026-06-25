// GET /api/marketing/contacts/history?email=...
//
// Einwilligungs-Historie EINES Kontakts (Art.-7-Nachweis) — on-demand fürs
// Detail-Slide-over in /marketing/guests. Ersetzt die frühere globale
// marketing_consents-Vorab-Abfrage (datensparsam: nur die Events des geöffneten
// Kontakts werden geladen). Read-only, Daten unberührt.
//
// Auth: Backoffice-Session, Inhaber-only (Permission 'marketing.contacts').
// Hotel-gescopt. Mappt email → wallet_pass_ids + waitlist_ids und liest die
// zugehörigen Consent-Events dieses Hotels.

import type { APIRoute } from 'astro';
import {
  getUser, getUserHotels, getUserRole, hasPermission,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const role = await getUserRole(cookies, request, hotel.id);
  if (!role || !hasPermission(role, 'marketing.contacts')) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const email = (url.searchParams.get('email') ?? '').toLowerCase().trim();
  if (!email) return json({ ok: false, error: 'missing_email' }, 400);

  const sb = createSupabaseServiceRoleInstance();

  // Kontakt → IDs. waitlist.email ist DB-seitig lowercase (zuverlässig);
  // wallet_passes.guest_email NICHT garantiert → laden + case-insensitiv filtern.
  const [passesRes, waitlistRes] = await Promise.all([
    sb.from('wallet_passes').select('id, guest_email').eq('hotel_id', hotel.id).not('guest_email', 'is', null),
    sb.from('marketing_waitlist').select('id').eq('hotel_id', hotel.id).eq('email', email),
  ]);

  const passIds = (passesRes.data ?? [])
    .filter(p => (p.guest_email || '').toLowerCase().trim() === email)
    .map(p => p.id as string);
  const waitlistIds = (waitlistRes.data ?? []).map(w => w.id as string);

  if (passIds.length === 0 && waitlistIds.length === 0) return json({ ok: true, events: [] });

  // marketing_consents für diese IDs, hotel-gescopt, neueste zuerst.
  const orParts: string[] = [];
  if (passIds.length) orParts.push(`wallet_pass_id.in.(${passIds.join(',')})`);
  if (waitlistIds.length) orParts.push(`waitlist_id.in.(${waitlistIds.join(',')})`);

  const { data, error } = await sb
    .from('marketing_consents')
    .select('action, source, policy_version, created_at, wallet_pass_id, waitlist_id')
    .eq('hotel_id', hotel.id)
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json({ ok: false, error: error.message }, 500);

  const events = (data ?? []).map(ev => ({
    created_at: ev.created_at,
    action: ev.action,
    source: ev.source,
    policy_version: ev.policy_version,
    channel: ev.wallet_pass_id ? 'wallet' : 'email',
  }));

  return json({ ok: true, events });
};
