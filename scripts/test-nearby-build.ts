// Sprint E2 · Phase 6 — Demo: Nearby-Cache für Demo-Hotel komplett aufbauen
//
// Run via: npm run test:nearby-build

import { createClient } from '@supabase/supabase-js';
import { buildNearbyCache } from '../src/lib/places/nearby-actions';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: hotel } = await sb
    .from('hotels')
    .select('name, latitude, longitude, address_street, city')
    .eq('id', DEMO_HOTEL_ID).single();

  if (!hotel?.latitude || !hotel?.longitude) {
    console.error('Demo-Hotel hat keine lat/lng');
    process.exit(1);
  }

  console.log(`Hotel: ${hotel.name}`);
  console.log(`Adresse: ${hotel.address_street}, ${hotel.city}`);
  console.log(`Coordinates: ${hotel.latitude}, ${hotel.longitude}`);
  console.log('');
  console.log('Starting buildNearbyCache für alle 5 Kategorien...');

  const start = Date.now();
  const result = await buildNearbyCache(DEMO_HOTEL_ID, hotel.latitude as number, hotel.longitude as number);
  const dur = Date.now() - start;

  console.log('');
  console.log('═'.repeat(70));
  console.log(' Build-Result');
  console.log('═'.repeat(70));
  console.log(`Duration:      ${dur}ms`);
  console.log(`Refreshed:     [${result.refreshed_categories.join(', ')}]`);
  console.log(`Failed:        ${result.failed_categories.length}`);
  console.log(`Total places:  ${result.total_places_cached}`);

  // Verify per category
  const { data: cacheRows } = await sb
    .from('hotel_place_nearby_cache')
    .select('category, jsonb_array_length(cached_places) AS count, last_refresh')
    .eq('hotel_id', DEMO_HOTEL_ID);

  console.log('');
  console.log('Cache-Inhalt pro Kategorie:');
  for (const row of (cacheRows ?? []) as any[]) {
    console.log(`  · ${row.category.padEnd(12)} ${row.count} Places  (refreshed ${row.last_refresh})`);
  }

  // Stichprobe: 3 Restaurants
  const { data: restaurantCache } = await sb
    .from('hotel_place_nearby_cache')
    .select('cached_places')
    .eq('hotel_id', DEMO_HOTEL_ID)
    .eq('category', 'restaurant')
    .maybeSingle();

  if (restaurantCache?.cached_places) {
    const places = restaurantCache.cached_places as any[];
    console.log('');
    console.log('Sample (3 Restaurants):');
    for (const p of places.slice(0, 3)) {
      console.log(`  · ${p.name} — ⭐ ${p.rating ?? '-'} (${p.userRatingCount ?? 0}) — ${(p.formattedAddress ?? '').slice(0, 50)}`);
    }
  }
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
