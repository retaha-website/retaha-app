// Sprint Wallet · Phase 5 — Wallet-Pass für Gast erstellen
//
// POST /api/g/wallet/create
// Auth: Stay-Session-Cookie (retaha_stay)
// Body: { marketing_consent: boolean }
//
// Flow:
//   1. Stay-Session verifizieren → wir kennen stay + hotel
//   2. Gast aus stays.guest_id laden (für Email + Namen)
//   3. wallet_passes UPSERT auf (hotel_id, guest_email)
//      → bei first-visit: insert + first_visit_at = NOW
//      → bei re-visit: visit_count++ + last_visit_at = NOW
//   4. Marketing-Consent + IP-Hash + Policy-Version persistieren
//   5. Google Wallet Pass-Object via createPassObject() bzw. updatePassObject()
//   6. Signed Save-Link via signSaveLink() generieren
//   7. Antwort: { ok, save_link_url, pass_state }

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { createSupabaseServiceRoleInstance } from '../../../../lib/auth';
import { getStaySession } from '../../../../lib/auth/stay-session';
import { getEnv } from '../../../../lib/env';
import {
  createPassObject,
  updatePassObject,
  signSaveLink,
  type PassObjectInput,
} from '../../../../lib/wallet/google';
import { isWalletConfigured, getWalletConfig, buildPassObjectId } from '../../../../lib/wallet/config';

const MARKETING_CONSENT_POLICY_VERSION = '2026-06-01';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function hashClientIp(rawIp: string | null): string | null {
  if (!rawIp) return null;
  const salt = getEnv('STAY_SESSION_SECRET') || '';
  if (!salt) return null;
  return createHash('sha256').update(rawIp + salt).digest('hex').slice(0, 32);
}

function clientIp(request: Request): string | null {
  // Vercel-Edge: x-real-ip oder x-forwarded-for. Reihenfolge: forwarded[0] > real-ip.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isWalletConfigured()) {
    return json({ ok: false, error: 'wallet_not_configured' }, 503);
  }

  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { marketing_consent?: boolean };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const marketingConsent = body.marketing_consent === true;

  const sb = createSupabaseServiceRoleInstance();

  // Stay + Guest laden
  const { data: stay, error: stayErr } = await sb
    .from('stays')
    .select('id, hotel_id, guests!inner(id, email, first_name, last_name, language)')
    .eq('id', session.stay_id)
    .maybeSingle();
  if (stayErr || !stay) {
    return json({ ok: false, error: 'stay_not_found' }, 404);
  }
  const guest = Array.isArray((stay as any).guests) ? (stay as any).guests[0] : (stay as any).guests;
  if (!guest?.email) {
    return json({ ok: false, error: 'guest_email_missing' }, 400);
  }

  // Pre-check: existiert schon ein Pass für dieses (hotel, email)?
  const { data: existing } = await sb
    .from('wallet_passes')
    .select('id, google_object_id, visit_count, first_visit_at, marketing_consent_given, state')
    .eq('hotel_id', stay.hotel_id)
    .eq('guest_email', guest.email)
    .maybeSingle();

  const now = new Date();
  const cfg = getWalletConfig()!;

  let walletPassId: string;
  let visitCount: number;
  let firstVisitAt: Date;
  let isReturning = false;
  let consentWasGranted = false;  // wird für marketing_consents-Audit gebraucht

  if (existing) {
    walletPassId = existing.id;
    visitCount = (existing.visit_count ?? 1) + 1;
    firstVisitAt = new Date(existing.first_visit_at);
    isReturning = true;

    // Update wallet_passes
    const ipHash = hashClientIp(clientIp(request));
    const updatePayload: Record<string, any> = {
      visit_count: visitCount,
      last_visit_at: now.toISOString(),
      guest_first_name: guest.first_name ?? null,
      guest_last_name: guest.last_name ?? null,
    };
    // Re-Open eines opted-out Passes ist neuer Consent — bewusst noch nicht
    // implementiert (Re-Opt-In kann komplex sein). Wenn opted_out: bleibt so.
    if (marketingConsent && !existing.marketing_consent_given && existing.state === 'active') {
      updatePayload.marketing_consent_given = true;
      updatePayload.marketing_consent_given_at = now.toISOString();
      updatePayload.marketing_consent_ip_hash = ipHash;
      updatePayload.marketing_consent_policy_version = MARKETING_CONSENT_POLICY_VERSION;
      consentWasGranted = true;
    }
    await sb.from('wallet_passes').update(updatePayload).eq('id', walletPassId);
  } else {
    // Neu anlegen
    const ipHash = hashClientIp(clientIp(request));
    const { data: inserted, error: insErr } = await sb.from('wallet_passes').insert({
      hotel_id: stay.hotel_id,
      guest_email: guest.email,
      guest_first_name: guest.first_name ?? null,
      guest_last_name: guest.last_name ?? null,
      google_object_id: null,
      google_class_id: null,
      marketing_consent_given: marketingConsent,
      marketing_consent_given_at: marketingConsent ? now.toISOString() : null,
      marketing_consent_ip_hash: marketingConsent ? ipHash : null,
      marketing_consent_policy_version: marketingConsent ? MARKETING_CONSENT_POLICY_VERSION : null,
      visit_count: 1,
      first_visit_at: now.toISOString(),
      last_visit_at: now.toISOString(),
      state: 'active',
    }).select('id').single();
    if (insErr || !inserted) {
      console.error('[wallet/create] insert failed:', insErr);
      return json({ ok: false, error: insErr?.message || 'insert_failed' }, 500);
    }
    walletPassId = inserted.id;
    visitCount = 1;
    firstVisitAt = now;
    if (marketingConsent) consentWasGranted = true;
  }

  // Audit-Eintrag wenn Consent in diesem Call gegeben wurde
  // (Pattern wie marketing_consents/Sprint Wallet Phase 7)
  if (consentWasGranted) {
    const ipHashAudit = hashClientIp(clientIp(request));
    const ua = request.headers.get('user-agent')?.slice(0, 500) || null;
    const { error: auditErr } = await sb.from('marketing_consents').insert({
      wallet_pass_id: walletPassId,
      action: 'granted',
      source: 'wallet_add',
      ip_hash: ipHashAudit,
      user_agent: ua,
      policy_version: MARKETING_CONSENT_POLICY_VERSION,
    });
    if (auditErr) console.warn('[wallet/create] marketing_consents audit failed (non-fatal):', auditErr.message);
  }

  // Hotel-Name für Pass-Body
  const { data: hotel } = await sb
    .from('hotels')
    .select('name, default_language')
    .eq('id', stay.hotel_id)
    .maybeSingle();

  const passObjectInput: PassObjectInput = {
    walletPassUuid: walletPassId,
    hotelId: stay.hotel_id,
    hotelName: hotel?.name || 'Hotel',
    guestFirstName: guest.first_name ?? null,
    guestLastName: guest.last_name ?? null,
    visitCount,
    firstVisitAt,
    lastVisitAt: now,
    defaultLang: guest.language || hotel?.default_language || 'de',
  };

  // Google: Object-Create-or-Update
  let googleResult;
  if (isReturning && existing?.google_object_id) {
    googleResult = await updatePassObject(passObjectInput);
  } else {
    googleResult = await createPassObject(passObjectInput);
  }

  if (googleResult.ok && !existing?.google_object_id) {
    // Persist Google-IDs nur beim ersten Mal — sind danach deterministisch
    const objectId = buildPassObjectId(cfg.issuerId, walletPassId);
    await sb.from('wallet_passes').update({
      google_object_id: objectId,
      google_class_id: googleResult.classId,
    }).eq('id', walletPassId);
  }

  if (!googleResult.ok) {
    console.warn('[wallet/create] Google API not happy:', googleResult);
    // Trotzdem Save-Link versuchen (JWT-Save-Link arbeitet client-side, Google
    // löst dann den Pass beim Add ein — Object kann auch durch den Save-Link
    // angelegt werden). Wenn das ebenfalls scheitert, returnen wir den
    // Google-Status durchgängig.
  }

  const origin = new URL(request.url).origin;
  const saveLink = signSaveLink(passObjectInput, [origin]);
  if (!saveLink.ok || !saveLink.url) {
    return json({ ok: false, error: 'save_link_failed', google: googleResult }, 500);
  }

  return json({
    ok: true,
    save_link_url: saveLink.url,
    pass_state: { wallet_pass_id: walletPassId, visit_count: visitCount, is_returning: isReturning },
    google: googleResult,
  });
};
