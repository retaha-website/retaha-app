// Pre-Sprint-C · Mews Products/Services-Probe (Read-Only Diagnostic)
//
// Ausführen mit:  npm run probe:mews-products
// (intern: tsx --env-file=.env scripts/probe-mews-products.ts)
//
// Was es macht: Schaut nach was das Demo-Hotel an Services, Products und
// Reservation-Items wirklich hat — bevor wir orders/add bauen.
// Read-only, kein orders/add, kein DB-Touch. Nach Sprint-C-Abschluss löschen.

const baseUrl = process.env.MEWS_API_BASE_URL;
const clientToken = process.env.MEWS_DEMO_CLIENT_TOKEN;
const accessToken = process.env.MEWS_DEMO_ACCESS_TOKEN;
const client = process.env.MEWS_CLIENT_NAME;

if (!baseUrl || !clientToken || !accessToken || !client) {
  console.error('Missing env. Required: MEWS_API_BASE_URL, MEWS_DEMO_CLIENT_TOKEN, MEWS_DEMO_ACCESS_TOKEN, MEWS_CLIENT_NAME');
  process.exit(1);
}

const AUTH = { ClientToken: clientToken, AccessToken: accessToken, Client: client };

async function post<T = any>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = `${baseUrl}/api/connector/v1/${endpoint}`;
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...AUTH, ...params }),
  });
  const elapsed = Date.now() - start;
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ ${endpoint} → HTTP ${res.status} (${elapsed} ms)`);
    console.error(text);
    throw new Error(`${endpoint} failed: HTTP ${res.status}`);
  }
  console.log(`✓ ${endpoint} → HTTP ${res.status} (${elapsed} ms)`);
  return JSON.parse(text) as T;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function section(title: string) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(' ' + title);
  console.log('═'.repeat(70));
}

function sub(title: string) {
  console.log('');
  console.log('─── ' + title + ' ' + '─'.repeat(Math.max(0, 65 - title.length)));
}

// ============================================================
// D. configuration/get (Currency + TaxEnvironment + AcceptedCurrencyCodes)
// ============================================================
section('D · configuration/get — Currency + Tax');
const config = await post('configuration/get');
const enterprise = (config as any).Enterprise ?? {};
console.log('Enterprise.Name:                 ', enterprise.Name);
console.log('Enterprise.DefaultLanguageCode:  ', enterprise.DefaultLanguageCode);
console.log('Enterprise.Address.CountryCode:  ', enterprise.Address?.CountryCode);
console.log('Enterprise.Currencies:           ', JSON.stringify(enterprise.Currencies));
console.log('AcceptedCurrencyCodes:           ', (config as any).AcceptedCurrencyCodes);
console.log('Top-Level-Keys von config:       ', Object.keys(config as any));
sub('Roh-JSON Enterprise');
console.log(JSON.stringify(enterprise, null, 2));

// ============================================================
// A. services/getAll
// ============================================================
section('A · services/getAll — welche Service-Types existieren?');
const servicesResp = await post('services/getAll', { Limitation: { Count: 100 } });
const services = (servicesResp as any).Services ?? [];
console.log('Services-Anzahl:', services.length);
console.log('Top-Level-Keys:', Object.keys(servicesResp as any));
sub('Pro Service: Id, Name, Type, sonstige Felder');
for (const s of services) {
  console.log(`  · ${s.Id?.slice(0, 8)}…  Type=${s.Type ?? '(none)'}  Name=${JSON.stringify(s.Name ?? s.Names)}`);
  const extraKeys = Object.keys(s).filter(k => !['Id', 'Name', 'Names', 'Type'].includes(k));
  if (extraKeys.length > 0) console.log(`     extra: ${extraKeys.join(', ')}`);
}
sub('Eindeutige Service-Types');
console.log(unique(services.map((s: any) => s.Type)));
sub('Erstes Service komplett (Roh-JSON)');
if (services[0]) console.log(JSON.stringify(services[0], null, 2));

// ============================================================
// B. products/getAll
// ============================================================
section('B · products/getAll — Anzahl + Struktur + ChargingModes');
let productsResp: any;
try {
  productsResp = await post('products/getAll', { Limitation: { Count: 100 } });
} catch (e) {
  console.error('products/getAll failed without ServiceIds. Versuche mit allen Service-IDs als Filter…');
  const allServiceIds = services.map((s: any) => s.Id).filter(Boolean);
  if (allServiceIds.length > 0) {
    productsResp = await post('products/getAll', {
      ServiceIds: allServiceIds,
      Limitation: { Count: 100 },
    });
  } else {
    throw e;
  }
}
console.log('Top-Level-Keys:', Object.keys(productsResp));
const products = (productsResp.Products ?? []) as any[];
console.log('Products-Anzahl in dieser Page:', products.length);
console.log('Cursor (next page?):           ', productsResp.Cursor ?? '(none)');

if (products.length === 0) {
  console.log('');
  console.log('!! Keine Products in dieser Response — Pfad C+ wäre nicht möglich ohne Hotelier-Setup.');
} else {
  sub('Erstes Product komplett (Roh-JSON)');
  console.log(JSON.stringify(products[0], null, 2));

  sub('Eindeutige ChargingMode-Werte');
  console.log(unique(products.map(p => p.ChargingMode).filter(Boolean)));
  sub('Eindeutige PostingMode-Werte');
  console.log(unique(products.map(p => p.PostingMode).filter(Boolean)));
  sub('Eindeutige Classifications-Werte (flach)');
  const allClass = products.flatMap(p => (Array.isArray(p.Classifications) ? p.Classifications : []));
  console.log(unique(allClass));
  sub('Eindeutige Sprach-Codes in Names');
  const langCodes = products.flatMap(p => {
    if (p.Names && typeof p.Names === 'object') return Object.keys(p.Names);
    if (Array.isArray(p.LocalizedNames)) return p.LocalizedNames.map((n: any) => n.LanguageCode);
    return [];
  });
  console.log(unique(langCodes));

  sub('Erstes Product mit Preis (falls vorhanden)');
  const withPrice = products.find(p =>
    p.Price || p.NetValue || p.GrossValue || p.UnitAmount || p.Amount,
  );
  if (withPrice) console.log(JSON.stringify(withPrice, null, 2));
  else console.log('(kein Product mit erkennbarem Price-Feld gefunden in Top-Level — Roh-JSON oben prüfen)');

  sub('Bis zu 5 Products kompakt — Id, Name, ServiceId, ChargingMode');
  for (const p of products.slice(0, 5)) {
    const name = p.Names ? Object.values(p.Names)[0] : (p.Name ?? '(none)');
    console.log(`  · ${p.Id?.slice(0, 8)}…  service=${p.ServiceId?.slice(0, 8)}…  charge=${p.ChargingMode}  name=${name}`);
  }
}

// ============================================================
// C. reservations/getAll mit Items-Extent — kommen embedded Items?
// ============================================================
section('C · reservations/getAll — embedded Items mit Extent.Items?');
const now = new Date();
const future = new Date(now.getTime() + 90 * 86_400_000);
const resResp = await post('reservations/getAll/2023-06-06', {
  CollidingUtc: { StartUtc: now.toISOString(), EndUtc: future.toISOString() },
  Extent: { Reservations: true, Items: true, Customers: true },
  Limitation: { Count: 5 },
});
console.log('Top-Level-Keys:', Object.keys(resResp));
const reservations = ((resResp as any).Reservations ?? []) as any[];
const items = ((resResp as any).Items ?? []) as any[];
const customers = ((resResp as any).Customers ?? []) as any[];
console.log('Reservations:', reservations.length, '· Items:', items.length, '· Customers:', customers.length);

sub('Erste Reservation kompakt');
if (reservations[0]) {
  const r = reservations[0];
  console.log(`  Id:              ${r.Id}`);
  console.log(`  State:           ${r.State}`);
  console.log(`  AccountId:       ${r.AccountId}`);
  console.log(`  AccountType:     ${r.AccountType}`);
  console.log(`  AssignedResource:${r.AssignedResourceId}`);
  console.log(`  StartUtc:        ${r.StartUtc}`);
  console.log(`  EndUtc:          ${r.EndUtc}`);
  console.log(`  Top-Level-Keys:  ${Object.keys(r).join(', ')}`);
}

sub('Erstes Item komplett (Roh-JSON) — Was steckt im Rate inkludiert?');
if (items[0]) {
  console.log(JSON.stringify(items[0], null, 2));
} else {
  console.log('(keine Items im Response — Extent.Items hat nichts mitgeliefert oder dieses Window hat keine)');
}

if (items.length > 0) {
  sub('Eindeutige Item-Type/Kind-Werte über alle Items');
  console.log('Type:', unique(items.map(i => i.Type).filter(Boolean)));
  console.log('Kind:', unique(items.map(i => i.Kind).filter(Boolean)));
  console.log('ConsumptionUtc-Beispiele:', items.slice(0, 3).map(i => i.ConsumptionUtc));
  sub('Items pro Reservation — wie viele, welche Typen?');
  const byRes = new Map<string, any[]>();
  for (const i of items) {
    const rid = i.ReservationId ?? i.OrderId ?? '(unknown)';
    if (!byRes.has(rid)) byRes.set(rid, []);
    byRes.get(rid)!.push(i);
  }
  for (const [rid, list] of [...byRes.entries()].slice(0, 3)) {
    console.log(`  · ${rid.slice(0, 8)}… → ${list.length} Items, Types: ${unique(list.map((i: any) => i.Type ?? i.Kind))}`);
  }
}

console.log('');
console.log('═'.repeat(70));
console.log(' DONE — Roh-Output oben verwenden für MEWS_PRODUCTS_PROBE.md');
console.log('═'.repeat(70));
