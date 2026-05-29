// Sprint C Verifikation · Schritt 0b — Test-Daten-Status
// Checkt für das aktuell verbundene Demo-Hotel:
//   - breakfast_items (eigene Tabelle): Anzahl + wieviele mit price_cents>0
//   - hotel_settings.service_items[]: Anzahl + price_cents>0
//   - hotel_settings.conference_rooms[]: Anzahl + price_cents_per_hour>0

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';
const { data: integrations } = await supabase
  .from('mews_integrations')
  .select('hotel_id')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID)
  .limit(1);
const hotelId = integrations?.[0]?.hotel_id;
if (!hotelId) {
  console.error('FATAL: kein verbundenes Demo-Hotel (mews_integrations empty)');
  process.exit(1);
}
console.log('Hotel-Id:', hotelId);
console.log('');

// 1) breakfast_items
const { data: breakfastItems } = await supabase
  .from('breakfast_items')
  .select('id, name_de, price_cents, is_active')
  .eq('hotel_id', hotelId)
  .order('display_order');

console.log('── breakfast_items ──');
console.log('Total:                ', breakfastItems?.length ?? 0);
console.log('Mit price_cents > 0:  ', breakfastItems?.filter(b => (b.price_cents ?? 0) > 0).length ?? 0);
console.log('Aktive:               ', breakfastItems?.filter(b => b.is_active).length ?? 0);
if (breakfastItems && breakfastItems.length > 0) {
  console.log('Beispiele:');
  for (const b of breakfastItems.slice(0, 5)) {
    console.log(`  · ${b.id.slice(0,8)}…  ${(b.name_de ?? '').padEnd(30)}  ${b.price_cents ?? 0} cents  ${b.is_active ? 'active' : 'inactive'}`);
  }
}

// 2) hotel_settings.service_items + conference_rooms
const { data: settings } = await supabase
  .from('hotel_settings')
  .select('service_items, conference_rooms')
  .eq('hotel_id', hotelId)
  .maybeSingle();

const services = (settings?.service_items as any[] | null) ?? [];
const rooms = (settings?.conference_rooms as any[] | null) ?? [];

console.log('');
console.log('── hotel_settings.service_items[] ──');
console.log('Total:                ', services.length);
console.log('Mit price_cents > 0:  ', services.filter(s => (s.price_cents ?? 0) > 0).length);
if (services.length > 0) {
  console.log('Beispiele:');
  for (const s of services.slice(0, 5)) {
    console.log(`  · ${(s.id ?? '').slice(0,12)}…  ${(s.name_de ?? '').padEnd(30)}  ${s.price_cents ?? 0} cents`);
  }
}

console.log('');
console.log('── hotel_settings.conference_rooms[] ──');
console.log('Total:                ', rooms.length);
console.log('Mit price_cents_per_hour > 0:', rooms.filter(r => (r.price_cents_per_hour ?? 0) > 0).length);
if (rooms.length > 0) {
  console.log('Beispiele:');
  for (const r of rooms.slice(0, 5)) {
    console.log(`  · ${(r.id ?? '').slice(0,12)}…  ${(r.name_de ?? '').padEnd(30)}  ${r.price_cents_per_hour ?? 0} cents/h  cap=${r.capacity ?? '?'}`);
  }
}

console.log('');
console.log('── Push-Bereitschaft pro Typ ──');
const breakfastReady = (breakfastItems ?? []).some(b => b.is_active && (b.price_cents ?? 0) > 0);
const serviceReady = services.some(s => s.id && (s.price_cents ?? 0) > 0);
const conferenceReady = rooms.some(r => r.id && (r.price_cents_per_hour ?? 0) > 0);
console.log('breakfast:  ', breakfastReady ? '✓' : '✗ — keine aktiven Items mit Preis');
console.log('service:    ', serviceReady ? '✓' : '✗ — keine Items mit Preis');
console.log('conference: ', conferenceReady ? '✓' : '✗ — keine Räume mit Preis');
