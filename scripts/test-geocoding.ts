// Sprint E2 · Phase 3 — Geocoding-Test + Demo-Hotel-Setup
//
// Run via: npm run test:geocoding
//
// 1. Test Nominatim mit 2 Adressen
// 2. Setze Demo-Hotel-Adresse + lat/lng

import { createClient } from '@supabase/supabase-js';
import { geocodeAddress, buildAddressQuery } from '../src/lib/places/geocoding';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function main() {
  // ─── Test 1: 2 Sanity-Adressen ───────────────────────────────
  divider('1. Sanity — Nominatim mit 2 Adressen');
  const addresses = [
    'Hardenbergstraße 4, 10623 Berlin, DE',
    'Brandenburger Tor, 10117 Berlin, DE',
  ];
  for (const addr of addresses) {
    const start = Date.now();
    const result = await geocodeAddress(addr);
    const dur = Date.now() - start;
    if (result) {
      console.log(`✓ "${addr}"`);
      console.log(`  → lat ${result.lat.toFixed(4)}, lng ${result.lng.toFixed(4)}  (${dur}ms)`);
      console.log(`  → ${result.display_name.slice(0, 100)}`);
    } else {
      console.log(`✗ "${addr}" — nicht gefunden  (${dur}ms)`);
    }
  }

  // ─── Test 2: Demo-Hotel-Adresse setzen + geocoden ────────────
  divider('2. Demo-Hotel-Setup — Adresse + lat/lng persistieren');
  const demoAddress = {
    street: 'Hardenbergstraße 4',
    zip: '10623',
    city: 'Berlin',
    country: 'DE',
  };
  const query = buildAddressQuery(demoAddress);
  console.log(`Query: "${query}"`);

  const result = await geocodeAddress(query);
  if (!result) {
    console.error('✗ Geocoding fehlgeschlagen — Demo-Hotel-Setup übersprungen.');
    process.exit(1);
  }

  const { error } = await sb.from('hotels').update({
    address_street: demoAddress.street,
    address_zip: demoAddress.zip,
    city: demoAddress.city,
    country: demoAddress.country,
    latitude: result.lat,
    longitude: result.lng,
  }).eq('id', DEMO_HOTEL_ID);

  if (error) {
    console.error('✗ DB-Update fehlgeschlagen:', error.message);
    process.exit(1);
  }

  console.log(`✓ Demo-Hotel (id ${DEMO_HOTEL_ID.slice(0, 8)}…) updated:`);
  console.log(`  street: ${demoAddress.street}`);
  console.log(`  city:   ${demoAddress.zip} ${demoAddress.city}, ${demoAddress.country}`);
  console.log(`  📍      ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
  console.log(`  display_name: ${result.display_name.slice(0, 80)}…`);
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
