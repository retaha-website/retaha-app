// Sprint Legal/DSGVO Phase 2 — Consent-Endpoint
//
// POST /api/g/consent
// Body: { token?, consent_type, consent_given }
//   - token (optional): stay access_token. Wenn vorhanden, wird stay_id +
//     hotel_id im Log gespeichert. Anonyme Visits (vor Pairing) erlaubt.
//
// Aufruf via navigator.sendBeacon im Cookie-Banner — garantiert Flush
// vor Navigation, kein await nötig im UI.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  POLICY_VERSION,
  hashIp,
  extractClientIp,
  isConsentType,
} from '../../../lib/legal/consent.ts';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string; consent_type?: string; consent_given?: boolean };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!isConsentType(body.consent_type)) {
    return json({ ok: false, error: 'invalid_consent_type' }, 400);
  }
  const consentGiven = body.consent_type !== 'rejected' && body.consent_given !== false;

  const sb = createSupabaseServiceRoleInstance();

  // Optional: Stay + Hotel auflösen aus Token (anonyme Visits OK)
  let stayId: string | null = null;
  let hotelId: string | null = null;
  if (body.token) {
    const { data: stay } = await sb
      .from('stays')
      .select('id, hotel_id')
      .eq('access_token', body.token)
      .maybeSingle();
    if (stay) {
      stayId = stay.id;
      hotelId = stay.hotel_id;
    }
  }

  const ipHash = hashIp(extractClientIp(request));
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  const { error } = await sb.from('consent_log').insert({
    stay_id: stayId,
    hotel_id: hotelId,
    consent_type: body.consent_type,
    consent_given: consentGiven,
    ip_hash: ipHash,
    user_agent: userAgent,
    policy_version: POLICY_VERSION,
  });

  if (error) {
    console.error('[consent] insert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, policy_version: POLICY_VERSION });
};
