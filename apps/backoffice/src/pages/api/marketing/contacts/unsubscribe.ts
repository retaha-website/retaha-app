// POST /api/marketing/contacts/unsubscribe
//
// Inhaber-getriggerte Soft-Abmeldung eines Kontakts, kanalgetrennt. KEIN Hard-Delete
// (DSGVO-Audit bleibt erhalten). Nutzt dieselbe Soft-Mechanik wie die Gast-seitigen
// Abmelde-Links: E-Mail → marketing_waitlist.unsubscribed_at; Wallet → wallet_passes
// state='opted_out'. Jeweils + marketing_consents-Eintrag action='revoked',
// source='owner_unsubscribe', hotel_id gesetzt (CHECK-konform).
//
// Body: { email: string, channel: 'email' | 'wallet' }
// Auth: Backoffice-Session, Inhaber-only (Permission 'marketing.contacts'). Hotel-gescopt.

import type { APIRoute } from 'astro';
import {
  getUser, getUserHotels, getUserRole, hasPermission,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';

const POLICY_VERSION = '2026-06-01';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const role = await getUserRole(cookies, request, hotel.id);
  if (!role || !hasPermission(role, 'marketing.contacts')) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  let body: { email?: string; channel?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const email = (body.email ?? '').toLowerCase().trim();
  const channel = body.channel;
  if (!email) return json({ ok: false, error: 'missing_email' }, 400);
  if (channel !== 'email' && channel !== 'wallet') return json({ ok: false, error: 'invalid_channel' }, 400);

  const sb = createSupabaseServiceRoleInstance();
  const now = new Date().toISOString();

  // ── E-Mail-Kanal: marketing_waitlist (email ist DB-seitig lowercase) ──
  if (channel === 'email') {
    const { data: rows, error } = await sb
      .from('marketing_waitlist')
      .select('id')
      .eq('hotel_id', hotel.id)
      .eq('email', email)
      .is('unsubscribed_at', null);
    if (error) return json({ ok: false, error: error.message }, 500);
    const targets = rows ?? [];
    if (targets.length === 0) return json({ ok: true, already: true, channel });
    for (const t of targets) {
      await sb.from('marketing_waitlist').update({ unsubscribed_at: now }).eq('id', t.id);
      await sb.from('marketing_consents').insert({
        wallet_pass_id: null,
        waitlist_id: t.id,
        hotel_id: hotel.id,
        action: 'revoked',
        source: 'owner_unsubscribe',
        policy_version: POLICY_VERSION,
      });
    }
    return json({ ok: true, channel, count: targets.length });
  }

  // ── Wallet-Kanal: wallet_passes (guest_email NICHT garantiert lowercase →
  //    aktive Pässe des Hotels laden und in JS case-insensitiv matchen) ──
  const { data: passes, error: passErr } = await sb
    .from('wallet_passes')
    .select('id, guest_email')
    .eq('hotel_id', hotel.id)
    .eq('state', 'active')
    .not('guest_email', 'is', null);
  if (passErr) return json({ ok: false, error: passErr.message }, 500);
  const targets = (passes ?? []).filter(p => (p.guest_email || '').toLowerCase().trim() === email);
  if (targets.length === 0) return json({ ok: true, already: true, channel });
  for (const p of targets) {
    await sb.from('wallet_passes').update({
      state: 'opted_out',
      opted_out_at: now,
      opted_out_reason: 'owner_unsubscribe',
      marketing_consent_given: false,
    }).eq('id', p.id);
    await sb.from('marketing_consents').insert({
      wallet_pass_id: p.id,
      hotel_id: hotel.id,
      action: 'revoked',
      source: 'owner_unsubscribe',
      policy_version: POLICY_VERSION,
    });
  }
  return json({ ok: true, channel, count: targets.length });
};
