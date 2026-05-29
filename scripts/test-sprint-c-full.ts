// Sprint C Verifikation · Voll-E2E für alle 3 Booking-Typen
//
// Für jeden Typ (breakfast / service / conference):
//   1. Booking direkt via Service-Role INSERTen (status='pending')
//   2. Status auf 'confirmed' updaten
//   3. pushBookingToMews(bookingId) aufrufen (try/catch wie der API-Handler)
//   4. mews_order_id / mews_push_error in DB schreiben
//   5. Resultat protokollieren
//
// Output: 3-Zeilen-Matrix + Detail-Diagnose pro Typ.
// Cleanup: am Ende alle drei Test-Bookings löschen (idempotent re-runnable).

import { createClient } from '@supabase/supabase-js';
import { pushBookingToMews, PushSkipped } from '../src/lib/mews/orders';

const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';
const TEST_NOTE = '[sprint-c-verify-script]';

// ============================================================
// 0) Hotel-ID + Test-Stay finden
// ============================================================
const { data: integrations } = await sb
  .from('mews_integrations')
  .select('hotel_id, default_currency, default_tax_code, pricing_mode, service_id_breakfast, service_id_service, service_id_conference')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID)
  .limit(1);
const integration = integrations?.[0];
if (!integration) {
  console.error('FATAL: kein verbundenes Demo-Hotel');
  process.exit(1);
}
const hotelId = integration.hotel_id;

console.log('═'.repeat(70));
console.log(' Sprint C Voll-Verifikation');
console.log('═'.repeat(70));
console.log('Hotel:           ', hotelId);
console.log('Currency:        ', integration.default_currency);
console.log('Tax-Code:        ', integration.default_tax_code);
console.log('Pricing-Mode:    ', integration.pricing_mode);
console.log('Service-Mappings:');
console.log('  breakfast:    ', integration.service_id_breakfast);
console.log('  service:      ', integration.service_id_service);
console.log('  conference:   ', integration.service_id_conference);

const { data: stays, error: staysErr } = await sb
  .from('stays')
  .select(`
    id, access_token, mews_reservation_id, state,
    guests(mews_customer_id, first_name, last_name)
  `)
  .eq('hotel_id', hotelId)
  .eq('is_active', true)
  .in('state', ['Confirmed', 'Started'])
  .not('mews_reservation_id', 'is', null)
  .not('guest_id', 'is', null)
  .limit(20);

if (staysErr) { console.error('stays-query failed:', staysErr); process.exit(1); }
const candidate = (stays ?? []).find(s => {
  const g = s.guests as any;
  return g && typeof g.mews_customer_id === 'string';
});
if (!candidate) {
  console.error('FATAL: kein Test-Stay mit Mews-Verknüpfung gefunden');
  process.exit(1);
}
const g = candidate.guests as any;
console.log('');
console.log('Test-Stay:       ', candidate.id, '·', [g.first_name, g.last_name].filter(Boolean).join(' '));
console.log('mews_reservation:', candidate.mews_reservation_id);
console.log('mews_customer:   ', g.mews_customer_id);

// ============================================================
// Lookup-Helper für hotel_settings (service/conference Preise)
// ============================================================
const { data: settings } = await sb
  .from('hotel_settings')
  .select('service_items, conference_rooms')
  .eq('hotel_id', hotelId)
  .maybeSingle();
const serviceItems = (settings?.service_items as any[]) ?? [];
const conferenceRooms = (settings?.conference_rooms as any[]) ?? [];

// ============================================================
// 1) Cleanup: alte Test-Bookings vom Script löschen (idempotent)
// ============================================================
const { error: cleanupErr } = await sb
  .from('bookings')
  .delete()
  .eq('stay_id', candidate.id)
  .filter('details->>__test_marker', 'eq', TEST_NOTE);
if (cleanupErr) console.warn('cleanup warning:', cleanupErr.message);

// ============================================================
// 2) Booking-Cases je Typ
// ============================================================

type BookingCase = {
  type: 'breakfast' | 'service' | 'conference';
  details: any;
  expectedNetCents: number;
  expectedUnitCount: number;
  description: string;
};

const firstService = serviceItems[0];
const firstConferenceRoom = conferenceRooms[0];

const cases: BookingCase[] = [
  {
    type: 'breakfast',
    details: {
      __test_marker: TEST_NOTE,
      date: '2026-06-09',
      time: '08:00',
      people: 2,
      table_preference: 'inside',
      notes: null,
    },
    expectedNetCents: 1500 * 2, // DEFAULT_BREAKFAST_PRICE_CENTS * people
    expectedUnitCount: 2,
    description: 'Frühstück · 2 Pers · 08:00',
  },
  {
    type: 'service',
    details: {
      __test_marker: TEST_NOTE,
      item_id: firstService?.id ?? null,
      item_name: firstService?.name_de ?? 'Spa-Massage',
      timing: 'scheduled',
      time: '19:00',
      notes: null,
    },
    expectedNetCents: firstService?.price_cents ?? 2000,
    expectedUnitCount: 1,
    description: `Service · ${firstService?.name_de ?? 'fallback'}`,
  },
  {
    type: 'conference',
    details: {
      __test_marker: TEST_NOTE,
      room_id: firstConferenceRoom?.id ?? null,
      room_name: firstConferenceRoom?.name_de ?? 'Konferenz',
      date: '2026-06-10',
      time: '14:00',
      duration_hours: 3,
      people: 8,
      occasion: 'Sprint-C-Verifikation',
      notes: null,
    },
    expectedNetCents: (firstConferenceRoom?.price_cents_per_hour ?? 5000) * 3,
    expectedUnitCount: 3,
    description: `Konferenz · ${firstConferenceRoom?.name_de ?? 'fallback'} · 3h`,
  },
];

type Result = {
  type: string;
  description: string;
  bookingId: string | null;
  status: string | null;
  orderId: string | null;
  pushError: string | null;
  pushReason: string | null;
  pushOk: boolean;
};

const results: Result[] = [];

for (const c of cases) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(` ${c.type.toUpperCase()} — ${c.description}`);
  console.log('═'.repeat(70));

  // INSERT als pending
  const { data: created, error: insertErr } = await sb
    .from('bookings')
    .insert({
      hotel_id: hotelId,
      stay_id: candidate.id,
      type: c.type,
      status: 'pending',
      details: c.details,
    })
    .select('id, status')
    .single();
  if (insertErr || !created) {
    console.error('  insert failed:', insertErr?.message);
    results.push({ type: c.type, description: c.description, bookingId: null, status: null, orderId: null, pushError: insertErr?.message ?? 'insert_failed', pushReason: 'insert_failed', pushOk: false });
    continue;
  }
  const bookingId = created.id;
  console.log('  ✓ INSERT  bookingId=', bookingId);

  // UPDATE → confirmed
  const { error: updErr } = await sb
    .from('bookings')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (updErr) {
    console.error('  status update failed:', updErr.message);
    results.push({ type: c.type, description: c.description, bookingId, status: 'pending', orderId: null, pushError: updErr.message, pushReason: 'status_update_failed', pushOk: false });
    continue;
  }
  console.log('  ✓ UPDATE  status=confirmed');

  // pushBookingToMews — analog wie /api/bookings/update-status
  const attemptedAt = new Date().toISOString();
  let pushOk = false;
  let orderId: string | null = null;
  let pushError: string | null = null;
  let pushReason: string | null = null;

  try {
    const out = await pushBookingToMews(bookingId);
    orderId = out.orderId;
    pushOk = true;
    await sb.from('bookings').update({
      mews_order_id: orderId,
      mews_push_attempted_at: attemptedAt,
      mews_push_error: null,
    }).eq('id', bookingId);
    console.log('  ✓ PUSH    orderId=', orderId);
  } catch (err) {
    const isSkip = err instanceof PushSkipped;
    pushReason = isSkip ? (err as PushSkipped).reason : 'error';
    pushError = (err as Error).message ?? String(err);
    const mewsBody = (err as any).body;
    await sb.from('bookings').update({
      mews_push_attempted_at: attemptedAt,
      mews_push_error: `${pushReason}: ${pushError}`,
    }).eq('id', bookingId);
    console.error(`  ✗ PUSH    (${pushReason}): ${pushError}`);
    if (mewsBody) {
      console.error('  Mews-Body:', JSON.stringify(mewsBody, null, 2));
    }
  }

  results.push({ type: c.type, description: c.description, bookingId, status: 'confirmed', orderId, pushError, pushReason, pushOk });
}

// ============================================================
// 3) Zusammenfassung
// ============================================================
console.log('');
console.log('═'.repeat(70));
console.log(' Ergebnis-Matrix');
console.log('═'.repeat(70));
console.log(`${'Typ'.padEnd(11)} ${'Push'.padEnd(7)} ${'OrderId / Error'.padEnd(40)}`);
console.log('─'.repeat(70));
for (const r of results) {
  const flag = r.pushOk ? '✓' : '✗';
  const detail = r.pushOk ? r.orderId : `${r.pushReason}: ${(r.pushError ?? '').slice(0, 60)}`;
  console.log(`${r.type.padEnd(11)} ${flag.padEnd(7)} ${(detail ?? '').toString().padEnd(40)}`);
}

const okCount = results.filter(r => r.pushOk).length;
console.log('');
console.log(`Summary: ${okCount}/${results.length} push erfolgreich`);
if (okCount === results.length) {
  console.log('🎉 Sprint C VOLL verifiziert für alle 3 Booking-Typen.');
} else {
  console.log('⚠ Lücken in obiger Matrix — siehe Detail-Logs.');
}
