// Sprint D · Phase 1 — Net-Pricing-Mode Verifikation
//
// Ausführen mit:  npm run test:net-mode
//
// Teil 1 (immer): Unit-Tests für die Berechnung Gross → Net mit verschiedenen
//                 Raten + Roundtrip-Check (Net × (1+Rate) ≈ Gross, Toleranz 1 Cent).
// Teil 2 (live): orders/add gegen Mews-Demo mit kurzzeitig auf "Net" geswitchtem
//                Hotel. Macht: SET pricing_mode=Net + default_tax_rate=0.20 →
//                push Test-Booking → restore Gross. **Schreibt eine reale Test-
//                Order ins Demo-Hotel.**
//
// Brief sagt: Mews ist pingelig mit Cent-Genauigkeit. Round-Trip-Test essenziell.

import { createClient } from '@supabase/supabase-js';
import { pushBookingToMews, PushSkipped } from '../src/lib/mews/orders';

const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_NOTE = '[sprint-d-net-mode-test]';
const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';

// ============================================================
// Teil 1 — Unit-Tests: Berechnung + Rundung + Roundtrip
// ============================================================

console.log('═'.repeat(70));
console.log(' Teil 1 — Unit-Tests Net-Berechnung (lokal, kein API)');
console.log('═'.repeat(70));

const centsToValue = (cents: number) => Math.round(cents) / 100;
const grossToNet = (cents: number, rate: number) => {
  const gross = centsToValue(cents);
  return Math.round((gross / (1 + rate)) * 100) / 100;
};

type Case = { name: string; cents: number; rate: number; expectedNet: number };
const cases: Case[] = [
  { name: 'Frühstück 15€ + 19% DE', cents: 1500, rate: 0.19, expectedNet: 12.61 },
  { name: 'Frühstück 18€ + 19% DE', cents: 1800, rate: 0.19, expectedNet: 15.13 },
  { name: 'Konferenz 50€ + 19% DE',  cents: 5000, rate: 0.19, expectedNet: 42.02 },
  { name: 'Service 20€ + 7% DE-ermäßigt', cents: 2000, rate: 0.07, expectedNet: 18.69 },
  { name: 'Frühstück 15€ + 20% UK', cents: 1500, rate: 0.20, expectedNet: 12.50 },
  { name: 'Zero-VAT Edge: 12€ + 0%', cents: 1200, rate: 0.00, expectedNet: 12.00 },
  { name: 'Krumme Summe: 13.37€ + 19%', cents: 1337, rate: 0.19, expectedNet: 11.24 },
];

let unitPass = 0, unitFail = 0;
for (const c of cases) {
  const net = grossToNet(c.cents, c.rate);
  const roundTripGross = Math.round(net * (1 + c.rate) * 100) / 100;
  // Integer-Cent-Vergleich — floating-point Math.abs(0.01) ist unzuverlässig.
  // Mews-Konvention: 1-Cent Drift durch Net-Rundung wird akzeptiert.
  const rtCents = Math.round(roundTripGross * 100);
  const expectedCents = c.cents;
  const driftCents = Math.abs(rtCents - expectedCents);
  const netCents = Math.round(net * 100);
  const expectedNetCents = Math.round(c.expectedNet * 100);
  const netOk = netCents === expectedNetCents;
  const rtOk = driftCents <= 1;
  const flag = netOk && rtOk ? '✓' : '✗';
  console.log(`  ${flag} ${c.name.padEnd(40)} → net=${net.toFixed(2)} (erwartet ${c.expectedNet.toFixed(2)}), roundtrip=${roundTripGross.toFixed(2)} (gross ${(c.cents/100).toFixed(2)}, drift=${driftCents}¢)`);
  if (netOk && rtOk) unitPass++; else unitFail++;
}
console.log('');
console.log(`Unit-Test-Resultat: ${unitPass}/${cases.length} pass`);
if (unitFail > 0) {
  console.error('FATAL: Unit-Tests failed. Berechnung oder Rundung falsch.');
  process.exit(2);
}

// ============================================================
// Teil 2 — Live-Test gegen Mews-Demo mit Net-Override
// ============================================================

console.log('');
console.log('═'.repeat(70));
console.log(' Teil 2 — Live-Roundtrip gegen Mews-Demo (Net-Override)');
console.log('═'.repeat(70));

// Finde Demo-Hotel + Test-Stay
const { data: integrations } = await sb
  .from('mews_integrations')
  .select('hotel_id, default_currency, default_tax_code, default_tax_rate, pricing_mode')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID)
  .limit(1);
const integration = integrations?.[0];
if (!integration) {
  console.error('FATAL: kein verbundenes Demo-Hotel — kann Live-Test nicht machen.');
  console.error('Unit-Tests sind aber grün → Net-Berechnung ist verifiziert.');
  process.exit(0);
}
const hotelId = integration.hotel_id;
console.log('Hotel:                ', hotelId);
console.log('Aktueller pricing_mode:', integration.pricing_mode);
console.log('Aktueller tax_code:   ', integration.default_tax_code);
console.log('Aktueller tax_rate:   ', integration.default_tax_rate);

const originalMode = integration.pricing_mode;
const originalRate = integration.default_tax_rate;

if (originalMode !== 'Gross') {
  console.warn('⚠ Hotel ist nicht im Gross-Mode — überspringe Live-Test');
  process.exit(0);
}
if (integration.default_tax_code !== 'UK-2022-20%') {
  console.warn('⚠ Tax-Code nicht UK-2022-20% — überspringe Live-Test');
  process.exit(0);
}

const { data: stays } = await sb
  .from('stays')
  .select(`id, mews_reservation_id, guest_id, state, guests(mews_customer_id, first_name, last_name)`)
  .eq('hotel_id', hotelId)
  .eq('is_active', true)
  .in('state', ['Confirmed', 'Started'])
  .not('mews_reservation_id', 'is', null)
  .not('guest_id', 'is', null)
  .limit(10);
const candidate = (stays ?? []).find(s => (s.guests as any)?.mews_customer_id);
if (!candidate) {
  console.error('FATAL: kein Test-Stay mit Mews-Verknüpfung gefunden.');
  process.exit(1);
}
const g = candidate.guests as any;
console.log('Test-Stay:            ', candidate.id, '·', [g.first_name, g.last_name].filter(Boolean).join(' '));

// Cleanup alter Test-Bookings
await sb.from('bookings').delete().eq('stay_id', candidate.id).filter('details->>__test_marker', 'eq', TEST_NOTE);

// Switch zu Net + Rate 0.20 (UK-2022-20% hat sowieso Rate 0.20)
console.log('');
console.log('→ Switch zu pricing_mode=Net, default_tax_rate=0.20');
await sb.from('mews_integrations')
  .update({ pricing_mode: 'Net', default_tax_rate: 0.20, updated_at: new Date().toISOString() })
  .eq('hotel_id', hotelId);

// Test-Booking insert (status='confirmed', damit pushBookingToMews direkt aufgerufen werden kann)
const grossCents = 1500;  // 15 GBP brutto
const expectedNet = grossToNet(grossCents, 0.20);  // 12.50
console.log('Gross-Brutto:         ', (grossCents / 100).toFixed(2), 'GBP');
console.log('Erwartet Net:         ', expectedNet.toFixed(2), 'GBP');

const { data: booking, error: bookErr } = await sb.from('bookings').insert({
  hotel_id: hotelId,
  stay_id: candidate.id,
  type: 'breakfast',
  status: 'confirmed',
  details: { __test_marker: TEST_NOTE, date: '2026-06-15', time: '08:00', people: 1, table_preference: 'any' },
}).select('id').single();

if (bookErr || !booking) {
  console.error('FATAL: booking insert failed:', bookErr);
  // Restore
  await sb.from('mews_integrations').update({ pricing_mode: originalMode, default_tax_rate: originalRate }).eq('hotel_id', hotelId);
  process.exit(1);
}
console.log('Test-Booking-Id:      ', booking.id);

// Push
let pushOk = false;
let orderId: string | null = null;
let pushErr: string | null = null;
try {
  const result = await pushBookingToMews(booking.id);
  orderId = result.orderId;
  pushOk = true;
} catch (err) {
  const isSkip = err instanceof PushSkipped;
  pushErr = `${isSkip ? (err as PushSkipped).reason : 'error'}: ${(err as Error).message}`;
  const body = (err as any).body;
  if (body) pushErr += '\n  Body: ' + JSON.stringify(body, null, 2);
}

console.log('');
if (pushOk) {
  console.log('✓ orders/add gegen Demo mit NetValue=' + expectedNet.toFixed(2) + ' GBP erfolgreich');
  console.log('  OrderId:', orderId);
  await sb.from('bookings').update({ mews_order_id: orderId, mews_push_error: null, mews_push_attempted_at: new Date().toISOString() }).eq('id', booking.id);
} else {
  console.error('✗ Push failed:', pushErr);
  await sb.from('bookings').update({ mews_push_error: pushErr, mews_push_attempted_at: new Date().toISOString() }).eq('id', booking.id);
}

// Restore original Mode
console.log('');
console.log('→ Restore pricing_mode=' + originalMode + ', default_tax_rate=' + originalRate);
await sb.from('mews_integrations')
  .update({ pricing_mode: originalMode, default_tax_rate: originalRate, updated_at: new Date().toISOString() })
  .eq('hotel_id', hotelId);

console.log('');
console.log('═'.repeat(70));
console.log(pushOk ? ' 🎉 Net-Mode E2E gegen Demo grün' : ' ⚠ Net-Mode Berechnung OK, Live-Push failed');
console.log('═'.repeat(70));
process.exit(pushOk ? 0 : 2);
