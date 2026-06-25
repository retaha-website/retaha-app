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
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getStaySession } from '@retaha/auth';
import { getEnv } from '@retaha/db';
import {
  createPassClass,
  createPassObject,
  updatePassObject,
  signSaveLink,
  type PassObjectInput,
  type PassClassInput,
} from '@retaha/wallet';
import { isWalletConfigured, getWalletConfig, buildPassObjectId } from '@retaha/wallet';
import { triggerDripsForEvent } from '@retaha/marketing';
import { isDemoSession } from '../../../../lib/showcase/session';

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

// Relative Asset-Pfade (z.B. "/hotel-assets/logo.svg") zu absoluten URLs machen —
// Google fetcht Logo/Hero server-side und braucht öffentliche https-URLs.
function absoluteUrl(maybeRelative: string | null | undefined, origin: string): string | null {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return origin.replace(/\/$/, '') + (maybeRelative.startsWith('/') ? maybeRelative : `/${maybeRelative}`);
}

// Hotel-Row → PassClassInput. wallet_pass_bg/brand_color sind oft NULL →
// brand_primary (DB-Default #FF4A82) bzw. Anthrazit als Farb-Fallback, damit
// die Pass-Klasse nicht ohne Hintergrund/Hero kahl wirkt.
function buildClassInput(hotel: any, hotelId: string, origin: string): PassClassInput {
  return {
    hotelId,
    hotelName: hotel?.name || 'Hotel',
    brandColorHex: hotel?.brand_color || hotel?.brand_primary || '#1A1A1A',
    logoUrl: absoluteUrl(hotel?.logo_primary ?? hotel?.logo_dark ?? null, origin),
    heroImageUrl: absoluteUrl(hotel?.wallet_pass_bg ?? hotel?.hero_image_url ?? null, origin),
    defaultLang: hotel?.default_language || 'de',
  };
}

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isWalletConfigured()) {
    return json({ ok: false, error: 'wallet_not_configured' }, 503);
  }

  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  // Body ist optional — ein leerer POST-Body ist gültig (Consent default = false).
  // Nur echtes Malformed-JSON ergibt einen 400, jetzt mit Log-Zeile, damit
  // künftige Fälle in den Runtime-Logs sichtbar sind (nicht stilles 400).
  let body: { marketing_consent?: boolean } = {};
  try {
    const raw = (await request.text()).trim();
    if (raw) body = JSON.parse(raw);
  } catch {
    console.warn('[wallet/create] invalid JSON body');
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const marketingConsent = body.marketing_consent === true;

  const sb = createSupabaseServiceRoleInstance();
  const origin = new URL(request.url).origin;

  // ── Showcase-Pfad (Demo-Session) ──────────────────────────────────────────
  if (isDemoSession(session)) {
    const { data: sc } = await sb
      .from('showcase_sessions')
      .select('id, hotel_id, demo_data')
      .eq('id', session.stay_id)
      .maybeSingle();
    if (!sc) return json({ ok: false, error: 'stay_not_found' }, 404);

    const dd = (sc.demo_data ?? {}) as any;
    const guestEmail: string | null = dd.guest_email ?? null;
    if (!guestEmail) return json({ ok: false, error: 'guest_email_missing' }, 400);

    const guestFirstName: string | null = dd.guest_first_name ?? null;
    const guestLastName: string | null = dd.guest_last_name ?? null;

    // Pass-Lookup: scoped auf showcase_session_id (1 Pass pro Demo-Session)
    const { data: existing } = await sb
      .from('wallet_passes')
      .select('id, google_object_id, visit_count, first_visit_at, state')
      .eq('showcase_session_id', sc.id)
      .maybeSingle();

    const now = new Date();
    const cfg = getWalletConfig()!;
    let walletPassId: string;
    let visitCount: number;
    let firstVisitAt: Date;
    let isReturning = false;

    if (existing) {
      walletPassId = existing.id;
      visitCount = (existing.visit_count ?? 1) + 1;
      firstVisitAt = new Date(existing.first_visit_at);
      isReturning = true;
      await sb.from('wallet_passes').update({
        visit_count: visitCount,
        last_visit_at: now.toISOString(),
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
      }).eq('id', walletPassId);
    } else {
      const { data: inserted, error: insErr } = await sb.from('wallet_passes').insert({
        hotel_id: sc.hotel_id,
        showcase_session_id: sc.id,
        guest_email: guestEmail,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        google_object_id: null,
        google_class_id: null,
        marketing_consent_given: false,
        visit_count: 1,
        first_visit_at: now.toISOString(),
        last_visit_at: now.toISOString(),
        state: 'active',
      }).select('id').single();
      if (insErr || !inserted) {
        console.error('[wallet/create] showcase insert failed:', insErr);
        return json({ ok: false, error: insErr?.message || 'insert_failed' }, 500);
      }
      walletPassId = inserted.id;
      visitCount = 1;
      firstVisitAt = now;
    }

    const { data: hotel } = await sb
      .from('hotels')
      .select('name, default_language, brand_color, brand_primary, logo_primary, logo_dark, wallet_pass_bg, hero_image_url')
      .eq('id', sc.hotel_id)
      .maybeSingle();

    const passObjectInput: PassObjectInput = {
      walletPassUuid: walletPassId,
      hotelId: sc.hotel_id,
      hotelName: hotel?.name || 'Hotel',
      guestFirstName,
      guestLastName,
      visitCount,
      firstVisitAt,
      lastVisitAt: now,
      defaultLang: hotel?.default_language || 'de',
    };

    let googleResult;
    if (isReturning && existing?.google_object_id) {
      googleResult = await updatePassObject(passObjectInput);
    } else {
      // Klasse muss existieren, bevor das Objekt sie referenziert (sonst Google:
      // „Could not find necessary class"). Idempotent — 409 → already_exists.
      const classResult = await createPassClass(buildClassInput(hotel, sc.hotel_id, origin));
      if (!classResult.ok) console.warn('[wallet/create] showcase class ensure failed:', classResult);
      googleResult = await createPassObject(passObjectInput);
    }

    if (googleResult.ok && !existing?.google_object_id) {
      const objectId = buildPassObjectId(cfg.issuerId, walletPassId);
      await sb.from('wallet_passes').update({
        google_object_id: objectId,
        google_class_id: googleResult.classId,
      }).eq('id', walletPassId);
    }

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
  }

  // ── Echter Stay ───────────────────────────────────────────────────────────
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
      language: guest.language ?? null,
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
      language: guest.language ?? null,
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
      hotel_id: stay.hotel_id,
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
    .select('name, default_language, brand_color, brand_primary, logo_primary, logo_dark, wallet_pass_bg, hero_image_url')
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
    // Klasse muss existieren, bevor das Objekt sie referenziert (sonst Google:
    // „Could not find necessary class"). Idempotent — 409 → already_exists.
    const classResult = await createPassClass(buildClassInput(hotel, stay.hotel_id, origin));
    if (!classResult.ok) console.warn('[wallet/create] class ensure failed:', classResult);
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

  const saveLink = signSaveLink(passObjectInput, [origin]);
  if (!saveLink.ok || !saveLink.url) {
    return json({ ok: false, error: 'save_link_failed', google: googleResult }, 500);
  }

  // Sprint Wallet Phase 12 — Inline-Drip-Triggers
  // Best-Effort: triggerDripsForEvent fängt alle Fehler intern, kein await-Fehler
  // kann hier propagieren. Drip-Enqueue darf nie den Wallet-Create-Flow scheitern.
  if (isReturning) {
    // Wiederkehrer: visit_count wurde erhöht → milestone-Check
    await triggerDripsForEvent(stay.hotel_id, walletPassId, 'visit_count_milestone', { newVisitCount: visitCount });
  } else {
    // Neuer Pass: wallet_add UND first_visit feuern (in MVP äquivalent, da
    // visit_count beim Insert immer 1 ist). Sobald Modul E Wiederkehr-Erkennung
    // bringt, kann first_visit auch bei bestehenden Pässen NICHT mehr feuern —
    // dann ist der Unterschied bedeutsam.
    await triggerDripsForEvent(stay.hotel_id, walletPassId, 'wallet_add');
    await triggerDripsForEvent(stay.hotel_id, walletPassId, 'first_visit');
  }

  return json({
    ok: true,
    save_link_url: saveLink.url,
    pass_state: { wallet_pass_id: walletPassId, visit_count: visitCount, is_returning: isReturning },
    google: googleResult,
  });
};
