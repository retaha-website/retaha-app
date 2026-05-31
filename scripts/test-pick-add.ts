// Sprint E2 · Phase 4 — Demo: 2 Place-Picks via addPickToHotel
//
// Run via: npm run test:pick-add
//
// Holt 2 place_ids per Autocomplete + ruft addPickToHotel → cached_data
// kommt aus Google getPlaceDetails, persistiert via service-role.

import { createClient } from '@supabase/supabase-js';
import { placesAutocomplete } from '../src/lib/places/google-client';
import { addPickToHotel } from '../src/lib/places/pick-actions';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  // Hotel-Coordinates für Location-Bias
  const { data: hotelRow } = await sb
    .from('hotels')
    .select('latitude, longitude')
    .eq('id', DEMO_HOTEL_ID).single();
  if (!hotelRow?.latitude || !hotelRow?.longitude) {
    console.error('Demo-Hotel hat kein lat/lng — bitte Phase 3 ausführen');
    process.exit(1);
  }
  const { latitude, longitude } = hotelRow;
  console.log(`Hotel-Location: ${latitude}, ${longitude}`);

  // 2 Picks anlegen — Pick 1: Restaurant Maria, Pick 2: ein Café in Charlottenburg
  const picks: Array<{ query: string; category: 'restaurant' | 'cafe' | 'bar' | 'activity' | 'sight' }> = [
    { query: 'Restaurant Maria Berlin', category: 'restaurant' },
    { query: 'Café am Neuen See Berlin', category: 'cafe' },
  ];

  for (const { query, category } of picks) {
    console.log(`\n→ Suche "${query}" (${category})...`);
    const suggestions = await placesAutocomplete(query, { lat: latitude, lng: longitude, radius: 5000, languageCode: 'de' });
    if (!suggestions.length) {
      console.warn(`  ⚠ keine Suggestions — skip`);
      continue;
    }
    const top = suggestions[0];
    console.log(`  Top-Suggestion: ${top.mainText} (${top.secondaryText})`);
    console.log(`  → addPickToHotel(placeId=${top.placeId.slice(0, 20)}…, category=${category})`);

    const result = await addPickToHotel(sb as any, DEMO_HOTEL_ID, top.placeId, category);
    if (result.ok) {
      console.log(`  ✓ Pick angelegt — id=${result.pickId}`);
    } else {
      console.warn(`  ⚠ ${result.error}`);
    }
  }

  // Verify
  const { data: allPicks } = await sb
    .from('hotel_place_picks')
    .select('id, place_id, category, cached_data, photo_references')
    .eq('hotel_id', DEMO_HOTEL_ID);
  console.log(`\nDemo-Hotel hat jetzt ${allPicks?.length ?? 0} Picks:`);
  for (const p of allPicks ?? []) {
    const cd = p.cached_data as any;
    console.log(`  · [${p.category}] ${cd?.name ?? '(no name)'} — ⭐ ${cd?.rating ?? '-'} (${cd?.user_ratings_total ?? 0}) · ${p.photo_references?.length ?? 0} Fotos`);
  }
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
