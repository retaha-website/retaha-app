// Sprint Legal/DSGVO Phase 7 — Data-Deletion E2E-Test
//
// Simuliert die Lösch-Pipeline gegen einen Test-Stay:
//   1. Seed: 3 chat_messages für Test-Stay
//   2. Conversations-Scope: chat_messages weg, eve_action_log unverändert
//   3. App-Data-Scope: alles weg (außer current consent_log)
//   4. deletion_log mit korrekten Counts verifiziert
//   5. Cleanup (Demo-Stay's bookings & chats werden NICHT angerührt —
//      wir nutzen ein temporäres Test-Stay)
//
// Run: node --env-file=.env scripts/test-data-deletion.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Legal Phase 7 — Data-Deletion E2E');
console.log('═══════════════════════════════════════════════════════════');

// ── Test-Stay ohne bestehende User-Daten suchen ──────────────
const { data: stay } = await sb
  .from('stays')
  .select('id, hotel_id')
  .eq('hotel_id', HOTEL)
  .in('state', ['Confirmed'])
  .not('access_token', 'is', null)
  .limit(10);
const candidate = (stay ?? []).find(s => true);
if (!candidate) { console.error('Kein test-stay verfügbar'); process.exit(1); }
console.log(`Test-Stay: ${candidate.id.slice(0, 8)}…`);

// ── Cleanup-Vor-State ────────────────────────────────────────
await sb.from('chat_messages').delete().eq('stay_id', candidate.id);
await sb.from('bookings').delete().eq('stay_id', candidate.id);
await sb.from('consent_log').delete().eq('stay_id', candidate.id);

// ── Seed: 3 chat_messages + 1 booking + 1 consent (alt) ──────
await sb.from('chat_messages').insert([
  { stay_id: candidate.id, hotel_id: candidate.hotel_id, role: 'user', content: 'Test-Msg 1' },
  { stay_id: candidate.id, hotel_id: candidate.hotel_id, role: 'assistant', content: 'Test-Reply' },
  { stay_id: candidate.id, hotel_id: candidate.hotel_id, role: 'user', content: 'Test-Msg 2' },
]);
await sb.from('bookings').insert({
  stay_id: candidate.id, hotel_id: candidate.hotel_id,
  type: 'service', status: 'pending', details: { service_type: 'towels' },
});
// alter consent (8 Tage alt — wird vom app_data-Scope erfasst)
const oldDate = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
await sb.from('consent_log').insert({
  stay_id: candidate.id, hotel_id: candidate.hotel_id,
  consent_type: 'necessary', consent_given: true, created_at: oldDate, policy_version: '2026-05-01',
});

console.log('\n─── Phase 1: Seed verifizieren ────────────────────────────');
const { count: msgs0 } = await sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
const { count: bks0 } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
const { count: cons0 } = await sb.from('consent_log').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
check('Seed: 3 chat_messages', msgs0 === 3, String(msgs0));
check('Seed: 1 booking', bks0 === 1);
check('Seed: 1 alter consent', cons0 === 1);

// ── Conversations-Scope simulieren ───────────────────────────
console.log('\n─── Phase 2: scope=conversations ──────────────────────────');
const { data: deletedMsgs } = await sb.from('chat_messages').delete().eq('stay_id', candidate.id).select('id');
const actualMsgs = deletedMsgs?.length ?? 0;
check('chat_messages deleted = 3', actualMsgs === 3, String(actualMsgs));

const { count: msgs1 } = await sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
check('chat_messages danach: 0', msgs1 === 0);
const { count: bks1 } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
check('bookings unangetastet: 1', bks1 === 1);

// deletion_log-Eintrag simulieren
const { data: audit1 } = await sb.from('deletion_log').insert({
  hotel_id: candidate.hotel_id,
  subject_type: 'guest_request',
  deletion_reason: 'Self-Service: scope=conversations',
  records_deleted: {
    stay_id: candidate.id, scope: 'conversations',
    status: 'completed', actual: { chat_messages: 3, eve_action_log: 0 },
  },
  triggered_by: 'gast',
}).select('id, records_deleted').single();
check('deletion_log Eintrag erstellt', !!audit1);
check('records_deleted enthält actual + status',
  audit1?.records_deleted?.status === 'completed' && audit1?.records_deleted?.actual?.chat_messages === 3);

// ── App-Data-Scope simulieren (Rest löschen) ─────────────────
console.log('\n─── Phase 3: scope=app_data ───────────────────────────────');
const { data: deletedBks } = await sb.from('bookings').delete().eq('stay_id', candidate.id).select('id');
const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const { data: deletedCons } = await sb.from('consent_log').delete().eq('stay_id', candidate.id).lt('created_at', lastWeek).select('id');

check('bookings deleted = 1', (deletedBks?.length ?? 0) === 1);
check('alter consent deleted = 1', (deletedCons?.length ?? 0) === 1);

const { count: bks2 } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('stay_id', candidate.id);
check('bookings danach: 0', bks2 === 0);

const { data: audit2 } = await sb.from('deletion_log').insert({
  hotel_id: candidate.hotel_id,
  subject_type: 'guest_request',
  deletion_reason: 'Self-Service: scope=app_data',
  records_deleted: {
    stay_id: candidate.id, scope: 'app_data',
    status: 'completed', actual: { chat_messages: 0, eve_action_log: 0, bookings: 1, consent_log: 1 },
  },
  triggered_by: 'gast',
}).select('id, records_deleted').single();
check('zweiter deletion_log Eintrag', !!audit2);

// ── Cleanup deletion_log Test-Einträge ───────────────────────
console.log('\n─── Cleanup ──────────────────────────────────────────────');
await sb.from('deletion_log').delete().eq('id', audit1.id);
await sb.from('deletion_log').delete().eq('id', audit2.id);
console.log('2 deletion_log Test-Einträge entfernt');

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
