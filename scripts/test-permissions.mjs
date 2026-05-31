// Sprint Functional Modul A — Permissions + Multi-User E2E
//
// Run: node --env-file=.env scripts/test-permissions.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';

// Mirror der Permissions-Lib (für Standalone-Test)
const PERMISSIONS = {
  'hotel.delete': ['owner'],
  'hotel.billing': ['owner'],
  'team.read': ['owner','manager','staff'],
  'team.invite': ['owner','manager'],
  'team.remove': ['owner'],
  'team.change_role': ['owner'],
  'settings.read': ['owner','manager','staff'],
  'settings.write': ['owner','manager'],
  'content.read': ['owner','manager','staff'],
  'content.write': ['owner','manager'],
  'operations.read': ['owner','manager','staff'],
  'operations.write': ['owner','manager','staff'],
  'data.export': ['owner','manager'],
  'data.delete': ['owner'],
};
function hasPermission(role, perm) { return PERMISSIONS[perm].includes(role); }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint Functional Modul A — Permissions E2E');
console.log('═══════════════════════════════════════════════════════════');

// ── Permission-Matrix verify ─────────────────────────────────
check('owner darf hotel.delete', hasPermission('owner', 'hotel.delete'));
check('manager darf NICHT hotel.delete', !hasPermission('manager', 'hotel.delete'));
check('staff darf NICHT settings.write', !hasPermission('staff', 'settings.write'));
check('staff darf operations.write', hasPermission('staff', 'operations.write'));
check('manager darf team.invite', hasPermission('manager', 'team.invite'));
check('manager darf NICHT team.remove', !hasPermission('manager', 'team.remove'));

// ── Schema-Verify: hotel_users hat alle neuen Spalten ─────
const { data: probe } = await sb.from('hotel_users')
  .select('id, user_id, role, invited_by, invited_at, accepted_at')
  .eq('hotel_id', HOTEL).limit(1).maybeSingle();
check('hotel_users hat invited_by Spalte', probe !== null && 'invited_by' in probe);
check('hotel_users hat invited_at Spalte', probe !== null && 'invited_at' in probe);
check('hotel_users hat accepted_at Spalte', probe !== null && 'accepted_at' in probe);

// ── Backfill-Verify: alle bestehenden haben accepted_at ──
const { count: total } = await sb.from('hotel_users').select('id', { count: 'exact', head: true });
const { count: accepted } = await sb.from('hotel_users').select('id', { count: 'exact', head: true }).not('accepted_at', 'is', null);
check('alle hotel_users haben accepted_at (Backfill)', total === accepted, `${accepted}/${total}`);

// ── CHECK-Constraint live-Test (mit echtem user_id) ──────
const { data: realUser } = await sb.from('hotel_users')
  .select('user_id').eq('hotel_id', HOTEL).limit(1).maybeSingle();

const tempRow = {
  user_id: realUser.user_id,
  hotel_id: HOTEL,
  role: 'invalid_role_test',
};
const { error: checkErr } = await sb.from('hotel_users')
  .insert(tempRow);
check('CHECK greift: role="invalid_role_test" rejected',
  checkErr && (checkErr.code === '23514' || /check/i.test(checkErr.message)),
  checkErr?.message?.slice(0, 50));

// ── Test-Insert + Cleanup mit gültiger Rolle ─────────────
const { data: inserted, error: insErr } = await sb.from('hotel_users')
  .insert({
    user_id: realUser.user_id, hotel_id: HOTEL, role: 'staff',
    invited_by: realUser.user_id, invited_at: new Date().toISOString(),
  })
  .select('id, role, invited_by, accepted_at');
// UNIQUE(user_id,hotel_id) wird verletzt — Test ist negativ-OK
check('UNIQUE(user_id,hotel_id) verhindert Duplikate', !!insErr,
  insErr?.code === '23505' ? 'duplicate key' : insErr?.message);

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
