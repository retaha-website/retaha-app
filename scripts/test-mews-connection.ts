// Sprint 0+1 · Schritt 1b — Mews Connector API Connection-Test
//
// Ausführen mit:  npm run test:mews
// (intern: tsx --env-file=.env scripts/test-mews-connection.ts)
//
// Was es macht: POST /api/connector/v1/configuration/get gegen Mews-Demo-Hotel.
// Erwartete Response: HTTP 200 + Enterprise-Konfiguration.
// Bei 429: shared Demo-Hotel überlastet, später probieren.

const baseUrl = process.env.MEWS_API_BASE_URL;
const clientToken = process.env.MEWS_DEMO_CLIENT_TOKEN;
const accessToken = process.env.MEWS_DEMO_ACCESS_TOKEN;
const client = process.env.MEWS_CLIENT_NAME;

if (!baseUrl || !clientToken || !accessToken || !client) {
  console.error('❌ Fehlende Env-Variablen. Erforderlich:');
  console.error('   MEWS_API_BASE_URL, MEWS_DEMO_CLIENT_TOKEN, MEWS_DEMO_ACCESS_TOKEN, MEWS_CLIENT_NAME');
  console.error('');
  console.error('Aufrufen mit:  npm run test:mews');
  process.exit(1);
}

const url = `${baseUrl}/api/connector/v1/configuration/get`;
console.log('→ POST', url);
console.log('  client:', client);
console.log('');

const start = Date.now();

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientToken: clientToken,
      AccessToken: accessToken,
      Client: client,
    }),
  });

  const elapsed = Date.now() - start;
  console.log('←', response.status, response.statusText, `(${elapsed} ms)`);
  console.log('');

  if (response.status === 429) {
    console.error('⚠ Rate-limit (429). Shared Demo-Hotel ist gerade überlastet — in ein paar Minuten nochmal probieren.');
    process.exit(2);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    console.error('❌ Response ist kein JSON. Rohinhalt:');
    console.error(await response.text());
    process.exit(1);
  }

  if (!response.ok) {
    console.error('❌ Mews-API-Error:');
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log('✓ Verbindung steht. Mews-Konfiguration:');
  console.log('');
  const e = body.Enterprise ?? {};
  console.log('  Enterprise:   ', e.Name ?? '(unbekannt)');
  console.log('  Land/Stadt:   ', [e.Address?.Line1, e.Address?.City, e.Address?.CountryCode].filter(Boolean).join(', ') || '(unbekannt)');
  console.log('  Timezone:     ', e.TimeZoneIdentifier ?? '(unbekannt)');
  console.log('  Default-Lang: ', e.DefaultLanguageCode ?? '(unbekannt)');
  console.log('  Währungen:    ', body.AcceptedCurrencyCodes?.join(', ') ?? '(unbekannt)');
  console.log('  Services:     ', body.Services?.length ?? 0, 'verfügbar');
  console.log('');
  console.log('--- Vollständige Response (für Sprint-2-Schema-Planning) ---');
  console.log(JSON.stringify(body, null, 2));
} catch (err) {
  const e = err as Error & { cause?: unknown };
  console.error('❌ Netzwerk-/Fetch-Error:', e.message);
  if (e.cause) console.error('   Cause:', e.cause);
  process.exit(1);
}
