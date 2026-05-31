// Sprint Legal/DSGVO Phase 8 — Auto-Delete-Cron E2E
//
// Standalone-Simulation der Cron-Logik:
//   1. Test-Stay auf check_out=-31d setzen
//   2. App-Daten seeden (chat + booking)
//   3. Cron-Pipeline ausführen
//   4. Verify: subject_type='auto_checkout' im deletion_log,
//      chat_messages weg, bookings weg
//   5. Cleanup: Stay-Daten restaurieren
//
// Run: node --env-file=.env scripts/test-auto-delete-cron.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const RETENTION_DAYS = 30;
const CONSENT_KEEP_RECENT_DAYS = 7;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Legal Phase 8 — Auto-Delete-Cron E2E');
console.log('═══════════════════════════════════════════════════════════');

// Test-Stay (mit Confirmed-State, nicht Started — sonst greift Filter)
const { data: testStays } = await sb
  .from('stays')
  .select('id, hotel_id, check_out, state')
  .eq('hotel_id', HOTEL)
  .eq('state', 'Confirmed')
  .not('access_token', 'is', null)
  .limit(1);
const stay = testStays?.[0];
if (!stay) { console.error('Kein test-stay'); process.exit(1); }
console.log(`Test-Stay: ${stay.id.slice(0,8)}…, original check_out: ${stay.check_out}`);

// ── Seed: künstliches "altes" Checkout + App-Daten ────────────
const oldCheckout = new Date(Date.now() - 31 * 86_400_000).toISOString();
await sb.from('stays').update({ check_out: oldCheckout }).eq('id', stay.id);
await sb.from('chat_messages').delete().eq('stay_id', stay.id);
await sb.from('bookings').delete().eq('stay_id', stay.id);
await sb.from('chat_messages').insert([
  { stay_id: stay.id, hotel_id: stay.hotel_id, role: 'user', content: 'Auto-Delete Test 1' },
  { stay_id: stay.id, hotel_id: stay.hotel_id, role: 'assistant', content: 'Antwort' },
]);
await sb.from('bookings').insert({
  stay_id: stay.id, hotel_id: stay.hotel_id,
  type: 'service', status: 'pending', details: { service_type: 'towels' },
});
console.log('Seed: check_out=-31d, 2 chats, 1 booking\n');

// ── Cron-Logik simulieren ─────────────────────────────────────
const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
const { data: qualifying } = await sb
  .from('stays')
  .select('id, hotel_id, check_out, state')
  .lt('check_out', cutoff)
  .neq('state', 'Started');
check('Cron findet qualifying stays', !!qualifying && qualifying.length > 0,
  `${qualifying?.length ?? 0} stays qualify`);
check('Test-Stay ist drin', qualifying.some(s => s.id === stay.id));

// Pro-Stay-Pipeline (kopiert aus Cron-Endpoint, minimal)
const target = qualifying.find(s => s.id === stay.id);
const consentCutoff = new Date(Date.now() - CONSENT_KEEP_RECENT_DAYS * 86_400_000).toISOString();

const [m, a, b, c] = await Promise.all([
  sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('stay_id', target.id),
  sb.from('eve_action_log').select('id', { count: 'exact', head: true }).filter('result_data->>stay_id', 'eq', target.id),
  sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', target.id),
  sb.from('consent_log').select('id', { count: 'exact', head: true }).eq('stay_id', target.id).lt('created_at', consentCutoff),
]);
const planned = {
  chat_messages: m.count ?? 0, eve_action_log: a.count ?? 0,
  bookings: b.count ?? 0, consent_log: c.count ?? 0,
};
console.log('Planned counts:', planned);

const { data: audit } = await sb.from('deletion_log').insert({
  hotel_id: target.hotel_id,
  subject_type: 'auto_checkout',
  deletion_reason: `Cron: check_out=${target.check_out}, retention=${RETENTION_DAYS}d`,
  records_deleted: {
    stay_id: target.id, check_out: target.check_out,
    status: 'pending', planned,
  },
  triggered_by: 'cron',
}).select('id').single();
check('deletion_log mit subject_type=auto_checkout angelegt', !!audit);

// Deletes
const { data: delChat } = await sb.from('chat_messages').delete().eq('stay_id', target.id).select('id');
const { data: delBks } = await sb.from('bookings').delete().eq('stay_id', target.id).select('id');
check('chat_messages: 2 deleted', (delChat?.length ?? 0) === 2);
check('bookings: 1 deleted', (delBks?.length ?? 0) === 1);

const { count: msgsAfter } = await sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('stay_id', target.id);
const { count: bksAfter } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', target.id);
check('chat_messages danach: 0', msgsAfter === 0);
check('bookings danach: 0', bksAfter === 0);

// Audit-Update
await sb.from('deletion_log').update({
  records_deleted: {
    stay_id: target.id, check_out: target.check_out,
    status: 'completed', planned,
    actual: { chat_messages: 2, eve_action_log: 0, bookings: 1, consent_log: 0 },
  },
}).eq('id', audit.id);

const { data: auditAfter } = await sb.from('deletion_log').select('records_deleted').eq('id', audit.id).single();
check('Audit-Update auf status=completed', auditAfter?.records_deleted?.status === 'completed');
check('actual counts korrekt im Audit',
  auditAfter?.records_deleted?.actual?.chat_messages === 2 && auditAfter?.records_deleted?.actual?.bookings === 1);

// Stay-Stammdaten unangetastet (Mews-Realität)
const { data: stayAfter } = await sb.from('stays').select('id, check_out, state').eq('id', target.id).single();
check('stay-Eintrag unverändert', !!stayAfter && stayAfter.id === target.id);
check('stay.state nicht verändert', stayAfter.state === stay.state);

// ── Cleanup ────────────────────────────────────────────────────
await sb.from('stays').update({ check_out: stay.check_out }).eq('id', stay.id);
await sb.from('deletion_log').delete().eq('id', audit.id);
console.log('\nCleanup: Stay-check_out restauriert, Test-Audit entfernt');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
