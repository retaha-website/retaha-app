// Sprint C Verifikation — minimal Demo-Daten fürs Hotel
// breakfast_items + hotel_settings.service_items[] + hotel_settings.conference_rooms[]

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';
const { data: integrations } = await sb
  .from('mews_integrations')
  .select('hotel_id')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID)
  .limit(1);
const hotelId = integrations?.[0]?.hotel_id;
if (!hotelId) {
  console.error('FATAL: kein verbundenes Demo-Hotel');
  process.exit(1);
}
console.log('Hotel:', hotelId);

// 1) breakfast_items — INSERT 3 minimal items
const breakfastSeed = [
  { hotel_id: hotelId, display_order: 1, name_de: 'Continental Breakfast',  name_en: 'Continental Breakfast', price_cents: 1200, is_active: true, is_vegetarian: true,  category: 'Frühstück' },
  { hotel_id: hotelId, display_order: 2, name_de: 'English Breakfast',       name_en: 'English Breakfast',     price_cents: 1800, is_active: true, is_vegetarian: false, contains_eggs: true, contains_gluten: true, category: 'Frühstück' },
  { hotel_id: hotelId, display_order: 3, name_de: 'Veganes Frühstück',       name_en: 'Vegan Breakfast',       price_cents: 1500, is_active: true, is_vegan: true,       is_vegetarian: true,  category: 'Frühstück' },
];

// erst löschen falls vorhanden (idempotent)
await sb.from('breakfast_items').delete().eq('hotel_id', hotelId);
const { data: bfRows, error: bfErr } = await sb.from('breakfast_items').insert(breakfastSeed).select('id, name_de, price_cents');
if (bfErr) { console.error('breakfast_items INSERT failed:', bfErr); process.exit(1); }
console.log('✓ breakfast_items INSERT:', bfRows?.length ?? 0, 'items');

// 2) hotel_settings.service_items + conference_rooms
const serviceSeed = [
  { id: 'svc-spa-massage',     name_de: 'Spa-Massage 60 Minuten',  name_en: 'Spa Massage 60 min',  description_de: '', description_en: '', icon: 'default', price_cents: 8000 },
  { id: 'svc-laundry-express', name_de: 'Express-Wäscherei',       name_en: 'Express Laundry',     description_de: '', description_en: '', icon: 'default', price_cents: 2500 },
  { id: 'svc-airport-shuttle', name_de: 'Flughafen-Shuttle',       name_en: 'Airport Shuttle',     description_de: '', description_en: '', icon: 'default', price_cents: 4500 },
];

const conferenceSeed = [
  { id: 'conf-salon-a', name_de: 'Salon Anthrazit',   name_en: 'Salon Anthracite',   capacity: 12, price_cents_per_hour: 6000 },
  { id: 'conf-salon-b', name_de: 'Konferenzraum Pink', name_en: 'Conference Room Pink', capacity: 24, price_cents_per_hour: 10000 },
];

const { data: existing } = await sb
  .from('hotel_settings')
  .select('hotel_id')
  .eq('hotel_id', hotelId)
  .maybeSingle();

if (existing) {
  const { error } = await sb
    .from('hotel_settings')
    .update({ service_items: serviceSeed, conference_rooms: conferenceSeed, updated_at: new Date().toISOString() })
    .eq('hotel_id', hotelId);
  if (error) { console.error('hotel_settings UPDATE failed:', error); process.exit(1); }
  console.log('✓ hotel_settings UPDATE: 3 service_items + 2 conference_rooms');
} else {
  const { error } = await sb
    .from('hotel_settings')
    .insert({ hotel_id: hotelId, service_items: serviceSeed, conference_rooms: conferenceSeed });
  if (error) { console.error('hotel_settings INSERT failed:', error); process.exit(1); }
  console.log('✓ hotel_settings INSERT: 3 service_items + 2 conference_rooms');
}

console.log('');
console.log('Demo-Daten gesetzt. Run sprint-c-data-check zum Nachprüfen.');
