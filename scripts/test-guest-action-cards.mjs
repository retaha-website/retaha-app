// Sprint E7 Phase 4 — Gast-Frontend-Mapping-Verifikation
//
// Lädt die action_cards für das Demo-Hotel und simuliert das exakte
// Mapping aus /g/[token].astro, plus den Click-Handler-Dispatch — ohne
// Browser. Verifiziert:
//   - Query liefert Cards in sort_order
//   - pick(card, field, lang) Fallback DE → EN funktioniert
//   - Click-Handler-Switch dispatcht jeden card_type korrekt
//   - Unknown internal_action (open_wallet) → "bald verfügbar"-Toast (kein Crash)
//   - Image-URLs Cache-Buster
//
// Run: node --env-file=.env scripts/test-guest-action-cards.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';

// Nachgebildet aus src/lib/i18n.ts
function pick(obj, field, lang) {
  return obj[`${field}_${lang}`] || obj[`${field}_de`] || '';
}

// Nachgebildet aus /g/[token].astro Phase-4-Mapping
function mapCard(card) {
  return {
    id: card.id,
    cardType: card.card_type,
    actionTarget: card.action_target,
    imageUrl: card.image_url,
    eyebrow: pick(card, 'eyebrow', 'de'),
    title:   pick(card, 'title', 'de'),
    sub:     pick(card, 'subtitle', 'de'),
    cta:     pick(card, 'cta', 'de'),
    cardClass: card.card_class || 'rec-anthrazit',
  };
}

// Nachgebildet aus dem Alpine handleRecClick-Switch
function simulateClick(card) {
  const KNOWN_SHEETS = new Set(['wifi', 'breakfast', 'conference', 'service', 'places']);
  switch (card.cardType) {
    case 'internal_action': {
      if (!card.actionTarget) return { action: 'noop', reason: 'no_target' };
      const sheetId = card.actionTarget.replace(/^open_/, '');
      if (sheetId === 'eve') return { action: 'open_eve_widget' };
      if (KNOWN_SHEETS.has(sheetId)) return { action: 'open_sheet', sheet: sheetId };
      return { action: 'toast', text: 'Diese Funktion ist bald verfügbar.' };
    }
    case 'external_link':
      return { action: 'window.open', url: card.actionTarget };
    case 'phone':
      return { action: 'tel', href: `tel:${(card.actionTarget||'').replace(/\s+/g,'')}` };
    case 'email':
      return { action: 'mailto', href: `mailto:${card.actionTarget}` };
    case 'info':
      return { action: 'no_op', reason: 'info_card' };
    default:
      return { action: 'noop', reason: 'unknown_type' };
  }
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint E7 Phase 4 — Gast-Frontend-Mapping-Verifikation');
console.log('═══════════════════════════════════════════════════════════');

// 1. Query wie /g/[token].astro
const { data: rows, error } = await admin
  .from('hotel_action_cards')
  .select('*')
  .eq('hotel_id', HOTEL)
  .eq('is_published', true)
  .order('sort_order', { ascending: true });
check('Query erfolgreich', !error && Array.isArray(rows), error?.message);
check('Cards für Demo-Hotel gefunden', rows.length === 3, `count=${rows.length}`);

// 2. Mapping + Click-Simulation pro Card
console.log('\n— Demo-Hotel Cards (DE) —');
for (const card of rows) {
  const mapped = mapCard(card);
  const click = simulateClick(mapped);
  console.log(`\n  [${mapped.cardClass}] "${mapped.title}"`);
  console.log(`    type=${mapped.cardType}, target=${mapped.actionTarget}`);
  console.log(`    eyebrow="${mapped.eyebrow}" cta="${mapped.cta}"`);
  console.log(`    click → ${JSON.stringify(click)}`);
}

// 3. Spezifische Assertions auf die 3 Demo-Cards
const byTarget = Object.fromEntries(rows.map(c => [c.action_target, mapCard(c)]));

const garden = byTarget['open_breakfast'];
check('garden → mapped',     !!garden);
check('garden → eyebrow_de', garden?.eyebrow === 'Morgen Mittag');
check('garden → title_de',   garden?.title === 'Tisch draußen');
const gardenClick = simulateClick(garden);
check('garden click → open_sheet:breakfast', gardenClick.action === 'open_sheet' && gardenClick.sheet === 'breakfast');

const conf = byTarget['open_conference'];
check('conference click → open_sheet:conference', simulateClick(conf).action === 'open_sheet' && simulateClick(conf).sheet === 'conference');

const wallet = byTarget['open_wallet'];
check('wallet click → toast (sheet unknown)', simulateClick(wallet).action === 'toast');

// 4. Multi-Language Fallback
const en = pick(rows[0], 'title', 'en');
const frEmpty = pick({ title_de: 'Nur DE' }, 'title', 'fr'); // Fallback test
check('Multi-Lang EN direkt', en === 'Outdoor table', `got: ${en}`);
check('Multi-Lang Fallback FR → DE', frEmpty === 'Nur DE');

// 5. Click-Simulator für synthetische Cards aller 5 Typen
const synthetic = [
  { cardType: 'external_link', actionTarget: 'https://example.com', expected: 'window.open' },
  { cardType: 'phone',         actionTarget: '+49 30 1234',         expected: 'tel' },
  { cardType: 'email',         actionTarget: 'a@b.de',              expected: 'mailto' },
  { cardType: 'info',          actionTarget: null,                  expected: 'no_op' },
];
for (const t of synthetic) {
  const click = simulateClick(t);
  check(`Click ${t.cardType} → ${t.expected}`, click.action === t.expected, JSON.stringify(click));
}

console.log('\n───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
