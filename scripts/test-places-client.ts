// Sprint E2 · Phase 2 — Google Places Client Test
//
// Run via: npm run test:places
//
// 3 Scenarios:
//   1. Autocomplete "Restaurant Maria Berlin" → ≥ 1 Suggestion
//   2. Place Details (mit Atmosphere) für ein Place aus Test 1 → Reviews, Hours
//   3. Nearby Search Berlin-Charlottenburg (52.5063, 13.3239) → ≥ 10 Restaurants
//
// Plus Cost-Estimate-Log am Ende.

import {
  placesAutocomplete,
  getPlaceDetails,
  searchNearbyPlaces,
  buildPhotoUrl,
} from '../src/lib/places/google-client';

// SKU-Prices ($ per 1000 calls — Stand 2026)
const SKU_AUTOCOMPLETE = 2.83;
const SKU_NEARBY_ESS   = 5.00;
const SKU_DETAILS_ESS  = 5.00;
const SKU_DETAILS_ATM  = 20.00;

interface CostEntry { sku: string; calls: number; usd_per_1000: number; }
const costs: CostEntry[] = [];

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function main() {
  // ─── Test 1: Autocomplete ──────────────────────────────────────
  divider('1. Autocomplete — "Restaurant Maria Berlin"');
  const suggestions = await placesAutocomplete('Restaurant Maria Berlin', {
    lat: 52.5063, lng: 13.3239, radius: 5000, languageCode: 'de',
  });
  costs.push({ sku: 'Autocomplete (Per Session)', calls: 1, usd_per_1000: SKU_AUTOCOMPLETE });
  console.log(`Suggestions: ${suggestions.length}`);
  for (const s of suggestions.slice(0, 5)) {
    console.log(`  · ${s.mainText} — ${s.secondaryText} [${s.types.slice(0, 2).join(', ')}]`);
  }
  if (suggestions.length === 0) {
    console.error('⚠ Erwartete ≥ 1 Suggestion. Test 2+3 werden trotzdem laufen.');
  }

  // ─── Test 2: Place Details ───────────────────────────────────────
  divider('2. Place Details (Atmosphere) — erstes Suggestion-Result');
  let placeIdForDetails: string | null = suggestions[0]?.placeId ?? null;
  if (placeIdForDetails) {
    const details = await getPlaceDetails(placeIdForDetails, {
      includeAtmosphere: true,
      languageCode: 'de',
    });
    costs.push({ sku: 'Place Details (Atmosphere)', calls: 1, usd_per_1000: SKU_DETAILS_ATM });
    console.log(`Place: ${details.name}`);
    console.log(`  Address:     ${details.formattedAddress}`);
    console.log(`  Rating:      ${details.rating ?? '-'} (${details.userRatingCount ?? 0} reviews)`);
    console.log(`  Price-Level: ${details.priceLevel ?? '-'}`);
    console.log(`  Website:     ${details.websiteUri ?? '-'}`);
    console.log(`  Phone:       ${details.internationalPhoneNumber ?? '-'}`);
    console.log(`  Photos:      ${details.photoNames.length} (1. PhotoURL: ${buildPhotoUrl(details.photoNames[0] ?? '', 600).slice(0, 80)}...)`);
    console.log(`  Open-Now:    ${details.openingHours?.openNow ?? '-'}`);
    console.log(`  Hours:       ${details.openingHours?.weekdayDescriptions?.[0] ?? '-'}`);
    console.log(`  Reviews:     ${details.reviews?.length ?? 0}`);
    for (const r of (details.reviews ?? []).slice(0, 2)) {
      console.log(`    ⭐ ${r.rating} ${r.authorName} — "${r.text.slice(0, 80)}${r.text.length > 80 ? '...' : ''}"`);
    }
  } else {
    console.log('SKIP — kein placeId aus Test 1.');
  }

  // ─── Test 3: Nearby Search ───────────────────────────────────────
  divider('3. Nearby Search — Berlin-Charlottenburg (52.5063, 13.3239)');
  const nearby = await searchNearbyPlaces(52.5063, 13.3239, 'restaurant', {
    radius: 1500,
    maxResultCount: 20,
    languageCode: 'de',
  });
  costs.push({ sku: 'Nearby Search (Essentials)', calls: 1, usd_per_1000: SKU_NEARBY_ESS });
  console.log(`Nearby restaurants found: ${nearby.length}`);
  for (const p of nearby.slice(0, 8)) {
    const stars = p.rating ? `⭐ ${p.rating} (${p.userRatingCount ?? 0})` : '(no rating)';
    console.log(`  · ${p.name.padEnd(40)} ${stars}`);
  }
  if (nearby.length < 10) {
    console.warn(`⚠ Erwartete ≥ 10, gefunden ${nearby.length}.`);
  }

  // ─── Cost-Summary ────────────────────────────────────────────────
  divider('Cost-Estimate');
  let totalUsd = 0;
  for (const c of costs) {
    const usd = (c.calls / 1000) * c.usd_per_1000;
    totalUsd += usd;
    console.log(`  ${c.sku.padEnd(35)} ${c.calls} call(s)  @ $${c.usd_per_1000}/1k  =  $${usd.toFixed(5)}`);
  }
  console.log(`  ${' '.repeat(35)}                                       TOTAL: $${totalUsd.toFixed(5)}`);
  console.log('');
  console.log('Hinweis: ohne Free-Tier-Abzug. Mit Free-Tier (5k Autocomplete, 10k Nearby/Essentials, 1k Atmosphere) wäre dieser Test $0.');
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
