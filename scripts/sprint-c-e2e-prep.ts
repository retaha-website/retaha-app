// Sprint C · Phase 4 — E2E-Vorbereitung
//
// Ausführen mit:  npm run sprint-c:e2e-prep
//
// Liefert:
//   1) Aktuellen mews_integrations-Stand (Service-Mappings gesetzt?)
//   2) Einen gültigen Test-Token (Stay Confirmed/Started + mews_customer_id + mews_reservation_id)
//   3) Liste der existing Bookings für den Test-Stay (zum vorab-aufräumen falls nötig)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('═'.repeat(70));
console.log(' Sprint C Phase 4 — E2E Vorbereitung');
console.log('═'.repeat(70));

const { data: connections } = await supabase
  .from('mews_integrations')
  .select('hotel_id')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID)
  .limit(1);
const DEMO_HOTEL_ID = connections?.[0]?.hotel_id;
if (!DEMO_HOTEL_ID) {
  console.error('FATAL: kein verbundenes Demo-Hotel');
  process.exit(1);
}
console.log('Demo-Hotel:', DEMO_HOTEL_ID);

// 1) mews_integrations-Stand
const { data: integration } = await supabase
  .from('mews_integrations')
  .select(`
    default_currency, default_tax_code, pricing_mode, pricing_source,
    service_id_breakfast, service_id_service, service_id_conference,
    last_sync_at
  `)
  .eq('hotel_id', DEMO_HOTEL_ID)
  .maybeSingle();

console.log('');
console.log('── 1. mews_integrations ──');
if (!integration) {
  console.error('FATAL: Kein mews_integrations-Row für Demo-Hotel');
  process.exit(1);
}
console.log(JSON.stringify(integration, null, 2));

const missingMappings: string[] = [];
if (!integration.service_id_breakfast) missingMappings.push('service_id_breakfast');
if (!integration.service_id_service) missingMappings.push('service_id_service');
if (!integration.service_id_conference) missingMappings.push('service_id_conference');

if (missingMappings.length > 0) {
  console.log('');
  console.log('⚠ Service-Mappings fehlen:', missingMappings.join(', '));
  console.log('  → Öffne /admin/pms und setze die Dropdowns. Dann nochmal ausführen.');
  console.log('  Empfehlung aus Phase 2c-Probe:');
  console.log('    Frühstück:  Breakfast Voucher  (15ea4f49-ae4a-49be-ad39-b3d3009d184a)');
  console.log('    Service:    Room service 20%   (0bcd98f1-…)  ODER  Loundry');
  console.log('    Konferenz:  Function Room Hire (5e96e0fd-…)  ODER  Room rental');
}

// 2) Test-Token finden
console.log('');
console.log('── 2. Test-Token-Suche ──');
const { data: stays, error: staysErr } = await supabase
  .from('stays')
  .select(`
    id, access_token, check_in, check_out, state, is_active,
    mews_reservation_id, room_id,
    guests(mews_customer_id, first_name, last_name)
  `)
  .eq('hotel_id', DEMO_HOTEL_ID)
  .eq('is_active', true)
  .in('state', ['Confirmed', 'Started'])
  .not('mews_reservation_id', 'is', null)
  .not('guest_id', 'is', null)
  .limit(5);

if (staysErr) {
  console.error('FATAL: stays-Query failed:', staysErr.message);
  process.exit(1);
}

const candidate = (stays ?? []).find(s => {
  const g = s.guests as any;
  return g && typeof g.mews_customer_id === 'string';
});

if (!candidate) {
  console.error('FATAL: kein Test-Stay mit access_token + mews_customer_id + mews_reservation_id gefunden.');
  console.error('       Mögliche Ursache: Sync hat noch nicht alle Daten gepullt.');
  process.exit(1);
}

const g = candidate.guests as any;
console.log('');
console.log('Test-Stay-Id:        ', candidate.id);
console.log('Gast:                ', [g.first_name, g.last_name].filter(Boolean).join(' '));
console.log('State:               ', candidate.state);
console.log('Check-in/out:        ', candidate.check_in, '→', candidate.check_out);
console.log('mews_reservation_id: ', candidate.mews_reservation_id);
console.log('mews_customer_id:    ', g.mews_customer_id);
console.log('');
console.log('🌐 GAST-URL für E2E-Test:');
console.log('   http://localhost:4321/g/' + candidate.access_token);

// 3) Existing bookings für diesen Stay
console.log('');
console.log('── 3. Bestehende Bookings für diesen Stay ──');
const { data: bookings } = await supabase
  .from('bookings')
  .select('id, type, status, mews_order_id, mews_push_error, mews_push_attempted_at, created_at')
  .eq('stay_id', candidate.id)
  .order('created_at', { ascending: false })
  .limit(10);

if ((bookings ?? []).length === 0) {
  console.log('(keine existing bookings — sauberer Test)');
} else {
  for (const b of bookings ?? []) {
    const pushFlag = b.mews_order_id ? '✓ pushed (' + b.mews_order_id.slice(0, 8) + '…)' :
      b.mews_push_error ? '✗ error: ' + b.mews_push_error.slice(0, 60) :
      '— (not attempted)';
    console.log(`  · ${b.id.slice(0, 8)}…  ${b.type.padEnd(11)}  ${b.status.padEnd(10)}  ${pushFlag}`);
  }
}

console.log('');
console.log('═'.repeat(70));
console.log(' E2E-Ablauf');
console.log('═'.repeat(70));
console.log('1. Browser → ', 'http://localhost:4321/g/' + candidate.access_token);
console.log('2. Frühstück-Sheet öffnen + buchen (e.g. 2 Personen morgen 08:00)');
console.log('3. Browser → http://localhost:4321/admin/bookings');
console.log('4. Die neue pending Buchung → Bestätigen');
console.log('5. Diesen Script nochmal laufen lassen — die Buchung sollte');
console.log('   mews_order_id gesetzt haben + mews_push_error=NULL');
console.log('6. (Negativ-Test) /admin/pms → Disconnect → neue Buchung machen + confirm');
console.log('   → mews_push_error = "no_integration: …"');
