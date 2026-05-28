// Sprint 0+1 · Schritt 5 — Mews-Sync End-to-End-Test
//
// Ausführen mit:  npm run test:mews-sync
//
// Optional: windowDays als Argument, default 7 (klein halten beim Test —
// Demo-Hotel hat im 30d-Fenster ~7000 Reservations).
//
// Beispiel:  npm run test:mews-sync -- 14
//
// Nutzt useEnvCredentials: true → braucht keine mews_integrations-Row.

import { syncHotelFromMews } from '../src/lib/mews';

const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const windowDays = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 7;

console.log('═'.repeat(60));
console.log(' Mews Initial-Sync — Demo-Hotel');
console.log('═'.repeat(60));
console.log('Hotel-ID:       ', DEMO_HOTEL_ID);
console.log('Window:         ', windowDays, 'Tage (CollidingUtc von jetzt)');
console.log('Credentials:    ', 'ENV (kein mews_integrations-Lookup)');
console.log('');

try {
  const result = await syncHotelFromMews(DEMO_HOTEL_ID, {
    windowDays,
    useEnvCredentials: true,
  });

  console.log('✓ Sync erfolgreich');
  console.log('');
  console.log('  rooms upserted:             ', result.rooms);
  console.log('  stays upserted:             ', result.reservations);
  console.log('  guests upserted:            ', result.guests);
  console.log('  skipped (kein Room-cat):    ', result.skippedNoRoomCategory);
  console.log('  skipped (non-Customer):     ', result.skippedNonCustomerAccount);
  console.log('  skipped (non-relevant state):', result.skippedNonRelevantState);
  console.log('  duration:                   ', result.durationMs, 'ms');
  console.log('');
  console.log('Verifikation in Supabase Studio:');
  console.log('  SELECT COUNT(*) FROM rooms;');
  console.log('  SELECT COUNT(*) FROM stays;');
  console.log('  SELECT COUNT(*) FROM guests;');
} catch (err) {
  const e = err as Error;
  console.error('✗ Sync failed:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
}
