// Sprint 0+1 · Schritt 4 — MewsClient End-to-End Test (Mews API v2023-06-06)
//
// Ausführen mit:  npm run test:mews-client
//
// Testet:
//   1. getConfiguration()
//   2. getResources()       — Zimmer (mit Limitation: Count 100)
//   3. getReservations()    — CollidingUtc-Interval, Limitation 100
//   4. getCustomers()       — CustomerIds aus Test 3
//   5. Error-Smoke          — kaputter Endpoint → MewsApiError
//   6. getAllReservations() — Pagination-Convenience (sammelt alle Seiten)

import { getMewsClientFromEnv, MewsApiError, MewsRateLimitError } from '../src/lib/mews';

const sep = (label: string) => console.log('\n' + '─'.repeat(60) + '\n  ' + label + '\n' + '─'.repeat(60));

let failed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log('✓', name);
  } catch (err) {
    failed++;
    console.error('✗', name);
    if (err instanceof MewsApiError) {
      console.error('   MewsApiError status:', err.status);
      console.error('   body:', JSON.stringify(err.body, null, 2)?.slice(0, 600));
    } else {
      console.error('   ', (err as Error).message);
    }
  }
};

const client = getMewsClientFromEnv();

sep('Test 1 — getConfiguration()');
let config: any;
await test('getConfiguration returns enterprise data', async () => {
  config = await client.getConfiguration();
  if (!config.Enterprise?.Name) throw new Error('No Enterprise.Name in response');
  console.log('   Enterprise:', config.Enterprise.Name);
  console.log('   Timezone: ', config.Enterprise.TimeZoneIdentifier);
  console.log('   Currencies:', config.AcceptedCurrencyCodes?.join(', '));
});

sep('Test 2 — getResources()  [Limitation: Count 100]');
let resources: any;
await test('getResources returns rooms', async () => {
  resources = await client.getResources({
    Extent: { Resources: true, ResourceCategories: true },
    Limitation: { Count: 100 },
  });
  const count = resources.Resources?.length ?? 0;
  console.log('   Resources gefunden:', count);
  console.log('   ResourceCategories:', resources.ResourceCategories?.length ?? 0);
  console.log('   Cursor (more pages?):', resources.Cursor ?? 'none');
  if (count > 0) {
    const first = resources.Resources[0];
    console.log('   Erstes Beispiel:', first.Name ?? first.Id);
  }
});

sep('Test 3 — getReservations()  [CollidingUtc + Limitation]');
let reservations: any;
await test('getReservations returns reservations for next 30 days', async () => {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  reservations = await client.getReservations({
    CollidingUtc: { StartUtc: now.toISOString(), EndUtc: future.toISOString() },
    Extent: { Reservations: true, Customers: true, Items: true },
    Limitation: { Count: 100 },
  });
  const count = reservations.Reservations?.length ?? 0;
  const customerCount = reservations.Customers?.length ?? 0;
  console.log('   Reservations gefunden:', count);
  console.log('   Customers mitgeliefert:', customerCount);
  console.log('   Cursor (more pages?):', reservations.Cursor ?? 'none');
  if (count === 0) {
    console.log('   ⚠ Demo-Hotel hat aktuell keine Reservations in [jetzt, +30d]');
  }
});

sep('Test 4 — getCustomers() für CustomerIds aus Test 3');
await test('getCustomers returns matching customer rows', async () => {
  const customerIds: string[] = (reservations?.Reservations ?? [])
    .map((r: any) => r.CustomerId)
    .filter((id: unknown): id is string => typeof id === 'string')
    .slice(0, 5);

  if (customerIds.length === 0) {
    console.log('   ⏭ Übersprungen — keine CustomerIds in Test-3-Reservations');
    return;
  }

  const customers = await client.getCustomers({
    CustomerIds: customerIds,
    Extent: { Customers: true },
    Limitation: { Count: 100 },
  });
  console.log('   Customers angefragt:', customerIds.length);
  console.log('   Customers erhalten: ', customers.Customers?.length ?? 0);
});

sep('Test 5 — Error-Handling-Smoke (kaputter Endpoint)');
await test('MewsApiError wird bei 4xx-Response geworfen', async () => {
  try {
    await (client as any).post('does-not-exist/get');
    throw new Error('Expected MewsApiError but call succeeded');
  } catch (err) {
    if (!(err instanceof MewsApiError)) throw err;
    if (err instanceof MewsRateLimitError) throw new Error('Got 429 unexpectedly — endpoint fehlt erwartet 404');
    console.log('   Geworfener Status:', err.status);
  }
});

sep('Test 6 — getAllReservations()  [Pagination-Convenience]');
await test('getAllReservations sammelt alle Seiten transparent', async () => {
  // Größerer Zeitraum (90 Tage), kleinere Page-Size — testet Cursor-Loop falls Demo-Hotel >Count Reservations hat
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const all = await client.getAllReservations({
    CollidingUtc: { StartUtc: past.toISOString(), EndUtc: future.toISOString() },
    Extent: { Reservations: true, Customers: true },
    Limitation: { Count: 50 }, // bewusst klein für Pagination-Test
  });

  console.log('   Reservations gesamt:', all.Reservations?.length ?? 0);
  console.log('   Customers gesamt:   ', all.Customers?.length ?? 0);
  console.log('   Final-Cursor:       ', all.Cursor ?? 'null (Ende erreicht)');
});

sep('Zusammenfassung');
if (failed > 0) {
  console.error(`\n❌ ${failed} Test(s) failed\n`);
  process.exit(1);
}
console.log('\n✓ Alle MewsClient-Tests durchgelaufen — Sprint-1-Verifikation grün\n');
