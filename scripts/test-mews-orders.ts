// Sprint C · Phase 2c — Charge-to-Room Probe (addOrder mit heuristisch geswähltem TaxRateCode)
//
// Ausführen mit:  npm run test:mews-orders
// (intern: tsx --env-file=.env scripts/test-mews-orders.ts)
//
// Was es macht:
//   1) configuration/get → Default-Currency loggen (erwartet GBP für Demo)
//   2) services/getAll → einen Orderable Service mit "Breakfast" im Namen finden
//      (fallback: erstes aktives Orderable)
//   3) taxations/getAll → TaxRate-Codes für UK-2022 laden + heuristisch passenden
//      TaxRate-Code wählen (Strategy.Relative 0.20 > current Validity > erster)
//   4) Test-Stay aus retaha-DB suchen: Reservation mit mews_customer_id +
//      mews_reservation_id + State Confirmed/Started
//   5) orders/add EINMAL mit dem geswählten TaxRate-Code
//      → bei 4xx Response-Body komplett loggen + exit 2 (Eskalation, kein Raten)
//      → bei 200 OrderId loggen
//   6) Ergebnis-Block
//
// ⚠ Schreibt REAL eine Order ins Mews-Demo-Hotel. Wert: 5 GBP. Das ist okay
//   (Demo-Hotel zum Testen), aber NICHT gegen Production laufen lassen.

import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.MEWS_API_BASE_URL;
const clientToken = process.env.MEWS_DEMO_CLIENT_TOKEN;
const accessToken = process.env.MEWS_DEMO_ACCESS_TOKEN;
const client = process.env.MEWS_CLIENT_NAME ?? 'retaha 1.0.0';
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !clientToken || !accessToken || !supabaseUrl || !supabaseKey) {
  console.error('Missing env. Required:');
  console.error('  MEWS_API_BASE_URL, MEWS_DEMO_CLIENT_TOKEN, MEWS_DEMO_ACCESS_TOKEN,');
  console.error('  PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const AUTH = { ClientToken: clientToken, AccessToken: accessToken, Client: client };

async function mewsPost<T = any>(endpoint: string, params: Record<string, unknown> = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const url = `${baseUrl}/api/connector/v1/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...AUTH, ...params }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  return { ok: true, data: JSON.parse(text) as T };
}

function section(title: string) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(' ' + title);
  console.log('═'.repeat(70));
}

// ============================================================
// 1) configuration/get
// ============================================================
section('1 · configuration/get — Default-Currency');
const configRes = await mewsPost('configuration/get');
if (!configRes.ok) {
  console.error('FATAL: configuration/get failed:', configRes.status, configRes.body);
  process.exit(1);
}
const enterprise = (configRes.data.Enterprise ?? {}) as any;
const currencies = (enterprise.Currencies ?? []) as Array<{ Currency: string; IsDefault: boolean }>;
const defaultCurrency = currencies.find(c => c.IsDefault)?.Currency ?? 'GBP';
console.log('Enterprise:        ', enterprise.Name);
console.log('TaxEnvironment:    ', enterprise.TaxEnvironmentCode);
console.log('Pricing:           ', enterprise.Pricing);
console.log('Default-Currency:  ', defaultCurrency);

// ============================================================
// 2) services/getAll → "Breakfast"-Service finden
// ============================================================
section('2 · services/getAll — Orderable mit "Breakfast" im Namen');
const servicesRes = await mewsPost('services/getAll', { Limitation: { Count: 100 } });
if (!servicesRes.ok) {
  console.error('FATAL: services/getAll failed:', servicesRes.status, servicesRes.body);
  process.exit(1);
}
const allServices = (servicesRes.data.Services ?? []) as Array<{ Id: string; Name?: string; Type?: string; IsActive?: boolean }>;
const orderable = allServices.filter(s => s.Type === 'Orderable' && s.IsActive !== false);
console.log('Orderable+Active:  ', orderable.length, '/', allServices.length);

const breakfastService = orderable.find(s => /breakfast/i.test(s.Name ?? '')) ?? orderable[0];
if (!breakfastService) {
  console.error('FATAL: kein Orderable+Aktiver Service in der Liste.');
  process.exit(1);
}
console.log('Gewählter Service: ', breakfastService.Id, '·', breakfastService.Name);

// ============================================================
// 3) taxations/getAll — TaxRate-Codes für UK-2022
// ============================================================
section('3 · taxations/getAll — TaxRate-Codes für UK-2022');
const taxEnvCode = enterprise.TaxEnvironmentCode as string | undefined;
if (!taxEnvCode) {
  console.error('FATAL: Enterprise.TaxEnvironmentCode fehlt — kann taxations/getAll nicht eingrenzen.');
  process.exit(1);
}
const taxationsRes = await mewsPost('taxations/getAll', {
  TaxEnvironmentCodes: [taxEnvCode],
  Limitation: { Count: 100 },
});
if (!taxationsRes.ok) {
  console.error('FATAL: taxations/getAll failed:', taxationsRes.status, taxationsRes.body);
  process.exit(1);
}
console.log('Roh-Response taxations/getAll:');
console.log(JSON.stringify(taxationsRes.data, null, 2));

const allTaxRates = (taxationsRes.data.TaxRates ?? []) as Array<{
  Code: string;
  TaxationCode?: string;
  Value?: number;  // flacher rate-Wert (z.B. 0.20)
  Strategy?: { Discriminator?: string; Value?: { Value?: number } | number };
  // Mews-API-Typo: "ValidityInvervalsUtc" (V statt R)
  ValidityInvervalsUtc?: Array<{ StartUtc: string; EndUtc: string | null }>;
  ValidityIntervalsUtc?: Array<{ StartUtc: string; EndUtc: string | null }>;
}>;

console.log('');
console.log('TaxRates gefunden TOTAL:', allTaxRates.length, '(Mews ignoriert TaxEnvironmentCodes-Filter)');

// Mews liefert ALLE globalen TaxRates trotz TaxEnvironmentCodes-Filter.
// Wir filtern manuell auf TaxationCode === unser TaxEnvironment.
const taxRates = allTaxRates.filter(tr => tr.TaxationCode === taxEnvCode);
console.log('TaxRates nach TaxationCode==' + taxEnvCode + ':', taxRates.length);

if (taxRates.length === 0) {
  console.error('FATAL: keine TaxRates mit TaxationCode=' + taxEnvCode + ' gefunden.');
  console.error('Verfügbare TaxationCodes:', [...new Set(allTaxRates.map(tr => tr.TaxationCode))].slice(0, 30), '…');
  process.exit(1);
}

// Verfügbare Rates für dieses Environment komplett loggen (sind wenige)
console.log('');
console.log('TaxRates für ' + taxEnvCode + ':');
console.log(JSON.stringify(taxRates, null, 2));

const now = Date.now();
const isCurrent = (tr: typeof taxRates[number]) => {
  // Beide Spellings beachten (Mews-API-Typo)
  const intervals = tr.ValidityInvervalsUtc ?? tr.ValidityIntervalsUtc ?? [];
  if (intervals.length === 0) return true;
  return intervals.some(iv => {
    const start = iv.StartUtc ? Date.parse(iv.StartUtc) : -Infinity;
    const end = iv.EndUtc ? Date.parse(iv.EndUtc) : Infinity;
    return start <= now && now <= end;
  });
};

// Value-Extractor: kann flach (tr.Value) oder geschachtelt (tr.Strategy.Value.Value) sein
const rateValue = (tr: typeof taxRates[number]): number | null => {
  if (typeof tr.Value === 'number') return tr.Value;
  const sv = tr.Strategy?.Value;
  if (typeof sv === 'number') return sv;
  if (sv && typeof sv === 'object' && typeof (sv as any).Value === 'number') return (sv as any).Value;
  return null;
};

// Erste Wahl: Relative 0.20 (UK Standard 20% VAT) + current
let chosenTaxCode: string | null = null;
let chosenStrategy: string = '';

const standardVatCurrent = taxRates.find(tr =>
  tr.Strategy?.Discriminator === 'Relative' && rateValue(tr) === 0.20 && isCurrent(tr),
);
if (standardVatCurrent) {
  chosenTaxCode = standardVatCurrent.Code;
  chosenStrategy = 'Erste Wahl: Relative 0.20 + current ValidityInterval (UK Standard 20% VAT)';
} else {
  const anyStandardVat = taxRates.find(tr =>
    tr.Strategy?.Discriminator === 'Relative' && rateValue(tr) === 0.20,
  );
  if (anyStandardVat) {
    chosenTaxCode = anyStandardVat.Code;
    chosenStrategy = 'Fallback 1: Relative 0.20 (ohne current-Check)';
  } else {
    const currentRate = taxRates.find(isCurrent);
    if (currentRate) {
      chosenTaxCode = currentRate.Code;
      chosenStrategy = 'Fallback 2: erster current TaxRate';
    } else {
      chosenTaxCode = taxRates[0].Code;
      chosenStrategy = 'Fallback 3: erste TaxRate in der Liste';
    }
  }
}

console.log('');
console.log('Strategie:        ', chosenStrategy);
console.log('Gewählter TaxCode:', chosenTaxCode);

// ============================================================
// 4) Test-Stay aus retaha-DB suchen
// ============================================================
section('4 · DB-Stay-Lookup — mews_customer_id + mews_reservation_id + Confirmed/Started');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: stays, error: dbErr } = await supabase
  .from('stays')
  .select('id, mews_reservation_id, guest_id, state, check_in, check_out, guests(mews_customer_id, first_name, last_name)')
  .not('mews_reservation_id', 'is', null)
  .not('guest_id', 'is', null)
  .in('state', ['Confirmed', 'Started'])
  .limit(10);

if (dbErr) {
  console.error('FATAL: DB-Query failed:', dbErr.message);
  process.exit(1);
}

const candidate = (stays ?? []).find(s => {
  const g = s.guests as any;
  return g && typeof g.mews_customer_id === 'string';
});

if (!candidate) {
  console.error('FATAL: kein Test-Stay gefunden mit mews_customer_id + mews_reservation_id + State Confirmed/Started.');
  console.error('Mögliche Ursache: Sync ohne State-Filter laufen oder Demo-Daten leer.');
  console.error('Versuche zuerst:  npm run test:mews-sync -- 30');
  process.exit(1);
}

const guest = candidate.guests as any;
console.log('Stay-Id:           ', candidate.id);
console.log('mews_reservation_id:', candidate.mews_reservation_id);
console.log('mews_customer_id:  ', guest.mews_customer_id);
console.log('Guest-Name:        ', [guest.first_name, guest.last_name].filter(Boolean).join(' '));
console.log('State:             ', candidate.state);
console.log('Check-in/out:      ', candidate.check_in, '→', candidate.check_out);

// ============================================================
// 5) orders/add — Single-Attempt mit heuristisch gewähltem TaxRate-Code
// ============================================================
section('5 · orders/add — Single-Attempt mit TaxRate-Code aus Section 3');

// Gross-Pricing-Hotel: GrossValue statt NetValue als Feldname
// (Erkenntnis aus "Invalid GrossValue" mit NetValue + UK-2022-20%)
const isGrossPricing = enterprise.Pricing === 'Gross';
const payload = {
  ServiceId: breakfastService.Id,
  AccountId: guest.mews_customer_id,
  LinkedReservationId: candidate.mews_reservation_id,
  Items: [{
    Name: 'Test-Frühstück retaha (Sprint C Probe)',
    UnitCount: 1,
    UnitAmount: isGrossPricing
      ? { Currency: defaultCurrency, GrossValue: 6.00, TaxCodes: [chosenTaxCode!] }  // 5 net * 1.20 = 6 gross
      : { Currency: defaultCurrency, NetValue: 5.00, TaxCodes: [chosenTaxCode!] },
  }],
  Notes: `retaha Sprint C TaxCode-Probe — ignore (${isGrossPricing ? 6 : 5} ${defaultCurrency})`,
};

console.log('Gewählter TaxRate-Code:', chosenTaxCode);
console.log('Payload (ohne AUTH):');
console.log(JSON.stringify(payload, null, 2));

const orderRes = await mewsPost<{ OrderId: string }>('orders/add', payload);

let success: { taxCode: string; orderId: string } | null = null;
let failure: { status: number; body: string } | null = null;

if (orderRes.ok) {
  success = { taxCode: chosenTaxCode!, orderId: orderRes.data.OrderId };
  console.log('');
  console.log('✓ HTTP 200 — OrderId:', orderRes.data.OrderId);
} else {
  failure = { status: orderRes.status, body: orderRes.body };
  console.log('');
  console.log('✗ HTTP', orderRes.status);
  console.log('Response-Body:');
  try {
    console.log(JSON.stringify(JSON.parse(orderRes.body), null, 2));
  } catch {
    console.log(orderRes.body);
  }
}

// ============================================================
// 6) Ergebnis
// ============================================================
section('6 · Ergebnis');

if (success) {
  console.log('Charge-to-Room funktioniert.');
  console.log('');
  console.log('Funktionierender TaxCode:', success.taxCode);
  console.log('OrderId:                 ', success.orderId);
  console.log('AccountId (Customer):    ', guest.mews_customer_id);
  console.log('LinkedReservationId:     ', candidate.mews_reservation_id);
  console.log('');
  console.log('→ Diesen TaxCode in mews_integrations.default_tax_code speichern.');
  console.log('→ Order sollte im Mews-Operations-UI auf dem Customer + LinkedReservation sichtbar sein.');
} else {
  console.log('Single-Attempt gefailed — STOP + Eskalation an Taha (kein weiteres Raten).');
  console.log('');
  console.log('Versuchter TaxRate-Code:', chosenTaxCode);
  console.log('Strategie:              ', chosenStrategy);
  if (failure) {
    console.log('HTTP-Status:            ', failure.status);
    console.log('Response-Body (siehe Section 5 für formatted JSON).');
  }
  console.log('');
  console.log('Brief: nach Single-Attempt-Failure STOP + eskalieren, nicht weitere Codes raten.');
  process.exit(2);
}
