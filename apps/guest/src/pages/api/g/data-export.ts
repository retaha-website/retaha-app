// Sprint Legal/DSGVO Phase 6 — Daten-Export (Art. 15 DSGVO)
//
// GET /api/g/data-export
// Auth: Stay-Session-Cookie (retaha_stay HS256 JWT). Kein Token in URL.
//
// Liefert JSON-Download mit allen App-Daten zu diesem Stay:
//   - Stay-Daten (ohne raw_mews_data — die ist Mews-intern)
//   - Guest-Daten (verknüpft)
//   - Eve-Conversations (chat_messages)
//   - Buchungen (bookings)
//   - Eve-Action-Log
//   - Consent-History
//
// Sicherheit:
//   - Stay-Session-bound → kein Cross-Stay-Leak
//   - Service-Role-Read mit explizitem stay_id-Filter (Defense-in-Depth)
//   - Rate-Limit: max 1 Export pro 5 Minuten
//
// Mews-Ehrlichkeit: JSON enthält "note"-Hinweis dass Stay-Stammdaten
// direkt beim Hotel anzufordern sind. Konsistent mit Datenschutz §7.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getStaySession } from '@retaha/auth';
import {
  POLICY_VERSION,
  hashIp,
  extractClientIp,
} from '../../../lib/legal/consent';

const RATE_LIMIT_MINUTES = 5;

// Whitelist relevanter Mews-Felder die wir aus raw_mews_data übernehmen.
// (Rest ist Mews-Implementierungsdetail — nicht gast-relevant.)
const MEWS_WHITELIST = ['Notes', 'TimeUnitCount', 'Currency', 'TotalAmount'] as const;

function filterMewsRaw(raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, any> = {};
  for (const k of MEWS_WHITELIST) if (raw[k] !== undefined) out[k] = raw[k];
  return Object.keys(out).length > 0 ? out : null;
}

export const GET: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: 'no_stay_session' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const sb = createSupabaseServiceRoleInstance();

  // ── Rate-Limit ────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('data_export_log')
    .select('exported_at')
    .eq('stay_id', session.stay_id)
    .gte('exported_at', cutoff)
    .limit(1).maybeSingle();
  if (recent) {
    return new Response(JSON.stringify({
      ok: false, error: 'rate_limited',
      message: `Bitte warte ${RATE_LIMIT_MINUTES} Minuten zwischen Exporten.`,
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Daten laden ───────────────────────────────────────────────
  const [stayRes, chatRes, bookingsRes, actionRes, consentRes] = await Promise.all([
    sb.from('stays')
      .select('id, hotel_id, guest_id, room_id, check_in, check_out, checked_out_at, state, is_active, guest_count, raw_mews_data, guests(id, first_name, last_name, email, language), rooms(room_number, room_name)')
      .eq('id', session.stay_id).maybeSingle(),
    sb.from('chat_messages')
      .select('role, content, created_at')
      .eq('stay_id', session.stay_id)
      .order('created_at', { ascending: true }),
    sb.from('bookings')
      .select('id, type, status, details, created_at, updated_at')
      .eq('stay_id', session.stay_id)
      .order('created_at', { ascending: true }),
    sb.from('eve_action_log')
      .select('action_type, action_params, conversation_context, result, result_data, created_at')
      .filter('result_data->>stay_id', 'eq', session.stay_id)
      .order('created_at', { ascending: true }),
    sb.from('consent_log')
      .select('consent_type, consent_given, policy_version, user_agent, created_at')
      .eq('stay_id', session.stay_id)
      .order('created_at', { ascending: true }),
  ]);

  if (stayRes.error || !stayRes.data) {
    return new Response(JSON.stringify({ ok: false, error: 'stay_not_found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const stay = stayRes.data as any;
  const guest = (stay.guests ?? null) as any;
  const room = (stay.rooms ?? null) as any;

  const exportPayload = {
    export_date: new Date().toISOString(),
    policy_version: POLICY_VERSION,
    subject: {
      stay_id: stay.id,
      guest_name: guest ? [guest.first_name, guest.last_name].filter(Boolean).join(' ') : null,
      check_in: stay.check_in,
      check_out: stay.check_out,
    },
    data: {
      stay: {
        id: stay.id,
        hotel_id: stay.hotel_id,
        check_in: stay.check_in,
        check_out: stay.check_out,
        checked_out_at: stay.checked_out_at,
        state: stay.state,
        is_active: stay.is_active,
        guest_count: stay.guest_count,
        room: room ? { number: room.room_number, name: room.room_name } : null,
        mews_data_relevant: filterMewsRaw(stay.raw_mews_data),
      },
      guest: guest ? {
        first_name: guest.first_name,
        last_name: guest.last_name,
        email: guest.email,
        language: guest.language,
      } : null,
      conversations: (chatRes.data ?? []).map((m: any) => ({
        role: m.role, content: m.content, timestamp: m.created_at,
      })),
      bookings: (bookingsRes.data ?? []).map((b: any) => ({
        id: b.id, type: b.type, status: b.status, details: b.details,
        created_at: b.created_at, updated_at: b.updated_at,
      })),
      eve_actions: (actionRes.data ?? []).map((a: any) => ({
        type: a.action_type, params: a.action_params, context: a.conversation_context,
        result: a.result, timestamp: a.created_at,
      })),
      consents: (consentRes.data ?? []).map((c: any) => ({
        type: c.consent_type, given: c.consent_given,
        policy_version: c.policy_version, timestamp: c.created_at,
      })),
    },
    note: 'Stay-Stammdaten verwaltet das Hotel über sein PMS (Mews). Für vollständigen Datenauszug wende dich direkt ans Hotel — diese Datei enthält die App-spezifischen Daten plus die für den Concierge-Service relevanten Mews-Felder.',
  };

  const jsonBody = JSON.stringify(exportPayload, null, 2);
  const bytes = new TextEncoder().encode(jsonBody).byteLength;

  // ── Audit-Log schreiben (Art. 15 Nachweispflicht) ────────────
  await sb.from('data_export_log').insert({
    stay_id: session.stay_id,
    hotel_id: session.hotel_id,
    export_format: 'json',
    bytes_exported: bytes,
    ip_hash: hashIp(extractClientIp(request)),
  });

  const idPrefix = stay.id.slice(0, 8);
  const datePart = new Date().toISOString().slice(0, 10);
  return new Response(jsonBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="retaha-data-${idPrefix}-${datePart}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};
