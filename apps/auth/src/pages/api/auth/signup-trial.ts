/**
 * POST /api/auth/signup-trial — Self-Serve-Trial-Signup.
 *
 * Legt EINEN neuen Hotelier-Account + EIN neues Hotel an und startet einen
 * 14-Tage-Pro-Trial (Pro + Eve, keine Kreditkarte). Verschickt einen Magic-Link;
 * der Hotelier klickt ihn, landet via /callback eingeloggt im Backoffice.
 *
 * Body (JSON):
 *   - email:       required (Hotelier-Email)
 *   - hotel_name:  required
 *   - first_name:  optional
 *   - last_name:   optional
 *   - company:     Honeypot (Bots füllen es → wir tun nichts, melden „ok")
 *
 * Flow:
 *   1. Validierung + Honeypot + Rate-Limit pro Email
 *   2. Existiert die Email schon? → kein zweites Hotel anlegen (409)
 *   3. signInWithOtp({ shouldCreateUser: true }) → User anlegen + Magic-Link
 *   4. user_id auflösen (admin.listUsers), Name in user_profiles
 *   5. hotels-Insert (plan=pro, subscription_status=trial, trial 14 Tage; Slug via Trigger)
 *   6. hotel_settings-Insert (kein Trigger) + hotel_users-Insert (owner, sofort akzeptiert)
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { rateLimit } from '../../../lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRIAL_DAYS = 14;

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Website normalisieren: leere bleibt leer; ohne Schema → https:// davor.
function normalizeUrl(raw: string): string {
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const email = (body.email ?? '').toString().trim().toLowerCase();
  const hotelName = (body.hotel_name ?? '').toString().trim();
  const firstName = (body.first_name ?? '').toString().trim();
  const lastName = (body.last_name ?? '').toString().trim();
  const city = (body.city ?? '').toString().trim();
  const website = normalizeUrl((body.website ?? '').toString().trim());
  const honeypot = (body.company ?? '').toString().trim();

  // Honeypot: echte Nutzer sehen das Feld nicht. Gefüllt = Bot → still „ok".
  if (honeypot) return json({ ok: true });

  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (hotelName.length < 2) return json({ ok: false, error: 'invalid_hotel' }, 400);

  // Rate-Limit pro Email (3 Signups / Stunde).
  const limit = rateLimit(`signup-trial:${email}`, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return json({ ok: false, error: 'rate_limited' }, 429);

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const authAppUrl = getEnv('AUTH_APP_URL') ?? 'https://auth.retaha.de';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[signup-trial] missing supabase env');
    return json({ ok: false, error: 'server_config' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Email schon registriert? → kein zweites Hotel (Login statt Signup).
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list?.users?.some((u) => u.email?.toLowerCase() === email)) {
    return json({ ok: false, error: 'email_exists' }, 409);
  }

  // 3. User anlegen + Magic-Link senden (anon-Client, wie send-magic-link).
  const anon = createClient(supabaseUrl, anonKey);
  const { error: otpErr } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${authAppUrl}/callback` },
  });
  if (otpErr) {
    console.error('[signup-trial] signInWithOtp failed:', otpErr.message);
    return json({ ok: false, error: 'email_failed' }, 502);
  }

  // 4. user_id auflösen (User existiert nach signInWithOtp in auth.users).
  const { data: refresh } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = refresh?.users?.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) {
    console.error('[signup-trial] user_resolve_failed for', email);
    return json({ ok: false, error: 'user_resolve_failed' }, 500);
  }

  // Name in user_profiles (best effort — wird im Layout/Avatar gelesen).
  if (firstName || lastName) {
    const { error: profErr } = await admin
      .from('user_profiles')
      .upsert({ user_id: userId, first_name: firstName, last_name: lastName }, { onConflict: 'user_id' });
    if (profErr) console.warn('[signup-trial] user_profiles upsert:', profErr.message);
  }

  // 5. Hotel anlegen — Slug generiert trg_hotel_slug aus dem Namen.
  const nowIso = new Date().toISOString();
  const endsIso = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const hotelInsert: Record<string, unknown> = {
    name: hotelName,
    plan: 'pro',
    subscription_status: 'trial',
    trial_started_at: nowIso,
    trial_ends_at: endsIso,
  };
  // Eve-Kontext: Website + Stadt (Eve liest beide; kein Auto-Scrape).
  if (website) hotelInsert.website = website;
  if (city) hotelInsert.city = city;
  const { data: hotel, error: hotelErr } = await admin
    .from('hotels')
    .insert(hotelInsert)
    .select('id')
    .single();
  if (hotelErr || !hotel) {
    console.error('[signup-trial] hotel insert failed:', hotelErr?.message);
    return json({ ok: false, error: 'hotel_failed' }, 500);
  }

  // 6a. hotel_settings-Zeile (kein Trigger legt sie an). Eve im Pro-Trial aktiv —
  //     der Hotelier reichert Eve-Wissen (FAQs) im Onboarding an.
  const { error: hsErr } = await admin
    .from('hotel_settings')
    .insert({ hotel_id: hotel.id, eve_enabled: true });
  if (hsErr) console.warn('[signup-trial] hotel_settings insert:', hsErr.message);

  // 6b. Owner verknüpfen (sofort akzeptiert — kein Invite).
  const { error: linkErr } = await admin.from('hotel_users').insert({
    user_id: userId,
    hotel_id: hotel.id,
    role: 'owner',
    accepted_at: nowIso,
  });
  if (linkErr) {
    console.error('[signup-trial] hotel_users insert failed:', linkErr.message);
    return json({ ok: false, error: 'link_failed' }, 500);
  }

  return json({ ok: true });
};
