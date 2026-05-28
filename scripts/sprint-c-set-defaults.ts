// Sprint C · Phase 3 — Defaults für Demo-Hotel setzen
//
// Ausführen mit:  npm run sprint-c:set-defaults
// (intern: tsx --env-file=.env scripts/sprint-c-set-defaults.ts)
//
// Setzt für das Demo-Hotel manuell:
//   - default_tax_code = 'UK-2022-20%'   (aus Phase 2c Test-Erfolg)
//   - pricing_mode     = 'Gross'         (Demo-Hotel ist Gross-Pricing)
// Und verifiziert:
//   - default_currency = 'GBP'           (sollte aus Connect-Phase 1 schon da sein)
//   - service_id_*-Mappings              (vom Hotelier konfiguriert)
//
// Voraussetzung: Migration 20260528_sprintC_phase3_pricing_mode.sql ist durch.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('═'.repeat(70));
console.log(' Sprint C · Phase 3 — Defaults für aktuell verbundenes Demo-Hotel');
console.log('═'.repeat(70));

// 0) Aktuell verbundenes Demo-Hotel finden (Demo-Enterprise-Id)
const DEMO_ENTERPRISE_ID = '851df8c8-90f2-4c4a-8e01-a4fc46b25178';
const { data: integrations, error: lookupErr } = await supabase
  .from('mews_integrations')
  .select('hotel_id, environment')
  .eq('enterprise_id', DEMO_ENTERPRISE_ID);
if (lookupErr || !integrations || integrations.length === 0) {
  console.error('FATAL: kein verbundenes Demo-Hotel gefunden (enterprise_id=' + DEMO_ENTERPRISE_ID + ')');
  process.exit(1);
}
if (integrations.length > 1) {
  console.warn('⚠ Mehrere Demo-Connections gefunden — patche alle:', integrations.map(i => i.hotel_id));
}
const DEMO_HOTEL_IDS = integrations.map(i => i.hotel_id);
console.log('Hotel-IDs:', DEMO_HOTEL_IDS);
console.log('');

// 1) UPDATE
const { error: upErr } = await supabase
  .from('mews_integrations')
  .update({
    default_currency: 'GBP',
    default_tax_code: 'UK-2022-20%',
    pricing_mode: 'Gross',
    updated_at: new Date().toISOString(),
  })
  .in('hotel_id', DEMO_HOTEL_IDS);

if (upErr) {
  console.error('UPDATE failed:', upErr.message);
  process.exit(1);
}
console.log('✓ UPDATE durch — default_tax_code + pricing_mode gesetzt');

// 2) Verifikation
const { data, error: selErr } = await supabase
  .from('mews_integrations')
  .select(`
    hotel_id, enterprise_id, environment,
    default_currency, default_tax_code, pricing_mode, pricing_source,
    service_id_breakfast, service_id_service, service_id_conference,
    mews_products_count, last_sync_at, sync_status
  `)
  .eq('hotel_id', DEMO_HOTEL_IDS[0])
  .maybeSingle();

if (selErr || !data) {
  console.error('SELECT failed:', selErr?.message ?? 'no row');
  process.exit(1);
}

console.log('');
console.log('Aktueller Stand mews_integrations:');
console.log(JSON.stringify(data, null, 2));

console.log('');
console.log('── Diagnose ──');
const checks: Array<{ name: string; ok: boolean; value: any; hint?: string }> = [
  { name: 'default_currency', ok: data.default_currency === 'GBP', value: data.default_currency, hint: 'erwartet GBP (aus Connect Phase 1)' },
  { name: 'default_tax_code', ok: data.default_tax_code === 'UK-2022-20%', value: data.default_tax_code },
  { name: 'pricing_mode',     ok: data.pricing_mode === 'Gross',          value: data.pricing_mode },
  { name: 'pricing_source',   ok: data.pricing_source === 'retaha',       value: data.pricing_source, hint: 'erwartet "retaha" (Pfad A)' },
  { name: 'service_id_breakfast',  ok: !!data.service_id_breakfast,  value: data.service_id_breakfast,  hint: 'Hotelier-Setup im Backoffice' },
  { name: 'service_id_service',    ok: !!data.service_id_service,    value: data.service_id_service,    hint: 'Hotelier-Setup im Backoffice' },
  { name: 'service_id_conference', ok: !!data.service_id_conference, value: data.service_id_conference, hint: 'Hotelier-Setup im Backoffice' },
];

for (const c of checks) {
  const icon = c.ok ? '✓' : '⚠';
  console.log(`${icon} ${c.name.padEnd(25)} = ${JSON.stringify(c.value)}${c.hint && !c.ok ? '   ← ' + c.hint : ''}`);
}

console.log('');
console.log('Bereit für Phase 4 E2E:');
console.log('  · Wenn alle ✓ → Bookings vom Demo-Hotel pushen automatisch beim confirmed-Übergang');
console.log('  · Service-Mappings fehlend? → /admin/pms öffnen + Dropdowns setzen');
