// Sprint Legal/DSGVO Phase 6 — Data-Export E2E-Test
//
// Standalone: simuliert was der Endpoint serverseitig macht — alle Queries
// + Mews-Whitelist + Audit-Log — ohne über echten Stay-Cookie/dev-server.
//
// Run: node --env-file=.env scripts/test-data-export.mjs

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SALT = process.env.STAY_SESSION_SECRET ?? 'retaha-consent-fallback-salt-do-not-rely-on';
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const MEWS_WHITELIST = ['Notes', 'TimeUnitCount', 'Currency', 'TotalAmount'];

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Legal Phase 6 — Data-Export E2E');
console.log('═══════════════════════════════════════════════════════════');

// Test-Stay: Demo-Hotel, Confirmed, mit guest_id
const { data: stay, error: stayLoadErr } = await sb
  .from('stays')
  .select('id, hotel_id, guest_id, check_in, check_out, raw_mews_data, guests(first_name, last_name, email, language)')
  .eq('hotel_id', HOTEL)
  .in('state', ['Confirmed', 'Started'])
  .not('guest_id', 'is', null)
  .limit(1).maybeSingle();
check('Test-Stay geladen', !stayLoadErr && !!stay, stay?.id);
if (!stay) process.exit(1);

console.log(`Stay ${stay.id.slice(0, 8)} — Gast: ${stay.guests?.first_name ?? '?'} ${stay.guests?.last_name ?? '?'}`);

// ── Simuliere alle Queries des Endpoints parallel ──────────────
const [chatRes, bookingsRes, actionRes, consentRes] = await Promise.all([
  sb.from('chat_messages').select('role, content, created_at').eq('stay_id', stay.id).order('created_at'),
  sb.from('bookings').select('id, type, status, details, created_at').eq('stay_id', stay.id).order('created_at'),
  sb.from('eve_action_log').select('action_type, created_at').filter('result_data->>stay_id', 'eq', stay.id).order('created_at'),
  sb.from('consent_log').select('consent_type, consent_given, policy_version, created_at').eq('stay_id', stay.id).order('created_at'),
]);

console.log(`  chat_messages: ${chatRes.data?.length ?? 0}`);
console.log(`  bookings:      ${bookingsRes.data?.length ?? 0}`);
console.log(`  eve_actions:   ${actionRes.data?.length ?? 0}`);
console.log(`  consents:      ${consentRes.data?.length ?? 0}`);

// ── Mews-Whitelist verify ──────────────────────────────────────
function filterMewsRaw(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const k of MEWS_WHITELIST) if (raw[k] !== undefined) out[k] = raw[k];
  return Object.keys(out).length > 0 ? out : null;
}
const filtered = filterMewsRaw(stay.raw_mews_data);
const allMewsKeys = stay.raw_mews_data ? Object.keys(stay.raw_mews_data) : [];
const whitelistedKeys = filtered ? Object.keys(filtered) : [];
check('Mews-Whitelist filtert raw_mews_data',
  whitelistedKeys.every(k => MEWS_WHITELIST.includes(k)),
  `from ${allMewsKeys.length} keys → ${whitelistedKeys.length} whitelisted`);

// ── Build Export-Payload (wie Endpoint) ───────────────────────
const payload = {
  export_date: new Date().toISOString(),
  policy_version: '2026-06-01',
  subject: {
    stay_id: stay.id,
    guest_name: stay.guests ? `${stay.guests.first_name ?? ''} ${stay.guests.last_name ?? ''}`.trim() : null,
    check_in: stay.check_in,
    check_out: stay.check_out,
  },
  data: {
    stay: {
      id: stay.id,
      check_in: stay.check_in,
      check_out: stay.check_out,
      mews_data_relevant: filtered,
    },
    guest: stay.guests,
    conversations: chatRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    eve_actions: actionRes.data ?? [],
    consents: consentRes.data ?? [],
  },
  note: 'Stay-Stammdaten verwaltet das Hotel über sein PMS (Mews). …',
};
const jsonStr = JSON.stringify(payload, null, 2);
const bytes = new TextEncoder().encode(jsonStr).byteLength;
console.log(`\nJSON size: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);

check('JSON valid (round-trip)', !!JSON.parse(jsonStr));
check('Payload enthält subject + data + note', !!(payload.subject && payload.data && payload.note));
check('Mews-Daten gefiltert (keine raw-Felder durch)',
  !jsonStr.includes('LinkedAccountIds') && !jsonStr.includes('AssignedResource'));

// ── data_export_log Insert + Cleanup ──────────────────────────
const ipHash = createHash('sha256').update('203.0.113.42' + SALT).digest('hex');
const { data: logRow, error: logErr } = await sb
  .from('data_export_log')
  .insert({
    stay_id: stay.id, hotel_id: stay.hotel_id,
    export_format: 'json', bytes_exported: bytes, ip_hash: ipHash,
  })
  .select('id, bytes_exported, ip_hash').single();
check('data_export_log INSERT erfolgreich', !logErr && !!logRow, logErr?.message);
check('bytes_exported persistiert', logRow?.bytes_exported === bytes);
check('ip_hash persistiert (NICHT Klartext)',
  logRow?.ip_hash === ipHash && logRow.ip_hash.length === 64);

// ── Rate-Limit-Simulation ────────────────────────────────────
const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const { data: recent } = await sb
  .from('data_export_log')
  .select('exported_at')
  .eq('stay_id', stay.id)
  .gte('exported_at', cutoff)
  .limit(1).maybeSingle();
check('Rate-Limit-Query findet frischen Export', !!recent);

// Cleanup
await sb.from('data_export_log').delete().eq('id', logRow.id);
console.log('Cleanup: Test-Audit-Eintrag entfernt');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
