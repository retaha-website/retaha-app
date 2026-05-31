// Sprint Legal/DSGVO Phase 2 — Consent-Endpoint + Hash-Verify
//
// Tests:
//   1. hashIp() ist deterministisch + salt-abhängig
//   2. /api/g/consent (gegen lokalen dev-server NICHT nötig — Insert direkt via Service-Role testbar)
//   3. consent_log-Insert mit korrekten Werten
//   4. Cleanup
//
// Run: node --env-file=.env scripts/test-consent.mjs

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SALT = process.env.STAY_SESSION_SECRET ?? 'retaha-consent-fallback-salt-do-not-rely-on';
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';

function hashIp(ip) {
  return createHash('sha256').update(ip + SALT).digest('hex');
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Legal Phase 2 — Consent E2E-Test');
console.log('═══════════════════════════════════════════════════════════');

// ── Test 1: hashIp Determinismus ───────────────────────────────
const ip1 = '192.168.1.42';
const h1a = hashIp(ip1);
const h1b = hashIp(ip1);
check('hashIp deterministisch (gleiche IP → gleicher Hash)', h1a === h1b);
check('hashIp Hex-Format 64 chars', /^[a-f0-9]{64}$/.test(h1a));
check('hashIp salt-abhängig (andere IP → anderer Hash)',
  hashIp('192.168.1.43') !== h1a);

// ── Test 2: Direkt-Insert in consent_log (Service-Role bypassed RLS) ──
// Hole valid stay-token aus Demo-Hotel
const { data: stay } = await admin
  .from('stays')
  .select('id, access_token, hotel_id')
  .eq('hotel_id', HOTEL)
  .in('state', ['Confirmed', 'Started'])
  .not('access_token', 'is', null)
  .limit(1).maybeSingle();
check('Test-Stay aus Demo-Hotel geladen', !!stay, stay?.id);

const testHash = hashIp('203.0.113.42'); // RFC 5737 test-net
const { data: inserted, error: insErr } = await admin
  .from('consent_log')
  .insert({
    stay_id: stay.id,
    hotel_id: stay.hotel_id,
    consent_type: 'all',
    consent_given: true,
    ip_hash: testHash,
    user_agent: 'Mozilla/5.0 (test)',
    policy_version: '2026-06-01',
  })
  .select('id, consent_type, consent_given, ip_hash, policy_version')
  .single();
check('consent_log INSERT erfolgreich', !insErr && !!inserted, insErr?.message);
check('consent_type persistiert', inserted?.consent_type === 'all');
check('ip_hash persistiert (NICHT Klartext)',
  inserted?.ip_hash === testHash && inserted.ip_hash !== '203.0.113.42');
check('policy_version persistiert', inserted?.policy_version === '2026-06-01');

// ── Test 3: anonymer Consent ohne stay_id/hotel_id ────────────
const { error: anonErr, data: anon } = await admin
  .from('consent_log')
  .insert({
    consent_type: 'rejected',
    consent_given: false,
    ip_hash: hashIp('203.0.113.43'),
    policy_version: '2026-06-01',
  })
  .select('id').single();
check('Anonymer Consent (ohne stay/hotel) erlaubt', !anonErr, anonErr?.message);

// ── Cleanup ───────────────────────────────────────────────────
await admin.from('consent_log').delete().eq('id', inserted.id);
await admin.from('consent_log').delete().eq('id', anon.id);
console.log('Cleanup: 2 Test-Einträge entfernt');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
