// Sprint i18n-Expansion Phase 3 — Daten-Migration für alle i18n-Tabellen
//
// Run: node --env-file=.env scripts/migrate-i18n-data.mjs [table]
//   ohne arg: alle Tabellen in Reihenfolge
//   mit arg: nur diese Tabelle (place_picks | action_cards | breakfast_items
//                              | eve_knowledge | hotel_settings)
//
// Idempotent: jede Function prüft ob _i18n schon befüllt → skip, sonst Insert.
//
// Migrations-Regel (Briefing Hinweis 5 — source-marker):
//   - Default-Sprache (meist DE) → source='original'
//   - Andere Sprachen (manuell befüllt) → source='override'
//     Warum 'override': diese Texte ÜBERSCHREIBEN was Auto-Translation produzieren
//     würde — der Phase-6-Hook lässt sie unangetastet.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NOW = new Date().toISOString();

/** Baut einen I18nValue-Eintrag. */
function entry(value, source) {
  if (!value || !value.trim()) return null;
  return { value: value.trim(), source, updated_at: NOW };
}

/** Baut I18nValue aus mehreren Sprach-Spalten. de=original, andere=override. */
function buildI18n(de, en, fr, es) {
  const result = {};
  const deEntry = entry(de, 'original');
  if (deEntry) result.de = deEntry;
  const enEntry = entry(en, 'override');
  if (enEntry) result.en = enEntry;
  const frEntry = entry(fr, 'override');
  if (frEntry) result.fr = frEntry;
  const esEntry = entry(es, 'override');
  if (esEntry) result.es = esEntry;
  return Object.keys(result).length > 0 ? result : null;
}

const argTable = process.argv[2];

// ── Mini-Step A: hotel_place_picks ─────────────────────────────────
async function migratePlacePicks() {
  console.log('\n─── hotel_place_picks ──────────────────────────────────');
  const { data: rows, error } = await admin
    .from('hotel_place_picks')
    .select('id, hotel_note, hotel_note_en, hotel_note_fr, hotel_note_es, hotel_note_i18n');
  if (error) { console.error(error); return { migrated: 0, skipped: 0, errors: 1 }; }

  let migrated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (r.hotel_note_i18n) { skipped++; continue; }
    const i18n = buildI18n(r.hotel_note, r.hotel_note_en, r.hotel_note_fr, r.hotel_note_es);
    if (!i18n) { skipped++; continue; }
    const { error: updErr } = await admin
      .from('hotel_place_picks')
      .update({ hotel_note_i18n: i18n })
      .eq('id', r.id);
    if (updErr) { console.error(`  ✗ ${r.id}:`, updErr.message); errors++; }
    else migrated++;
  }
  console.log(`  migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
  return { migrated, skipped, errors };
}

// ── Mini-Step B: hotel_action_cards ────────────────────────────────
async function migrateActionCards() {
  console.log('\n─── hotel_action_cards ─────────────────────────────────');
  const { data: rows, error } = await admin
    .from('hotel_action_cards')
    .select('id, title_de, title_en, title_fr, title_es, subtitle_de, subtitle_en, subtitle_fr, subtitle_es, eyebrow_de, eyebrow_en, eyebrow_fr, eyebrow_es, cta_de, cta_en, cta_fr, cta_es, title_i18n');
  if (error) { console.error(error); return { migrated: 0, skipped: 0, errors: 1 }; }

  let migrated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (r.title_i18n) { skipped++; continue; }
    const patch = {
      title_i18n:    buildI18n(r.title_de, r.title_en, r.title_fr, r.title_es),
      subtitle_i18n: buildI18n(r.subtitle_de, r.subtitle_en, r.subtitle_fr, r.subtitle_es),
      eyebrow_i18n:  buildI18n(r.eyebrow_de, r.eyebrow_en, r.eyebrow_fr, r.eyebrow_es),
      cta_i18n:      buildI18n(r.cta_de, r.cta_en, r.cta_fr, r.cta_es),
    };
    const { error: updErr } = await admin
      .from('hotel_action_cards')
      .update(patch)
      .eq('id', r.id);
    if (updErr) { console.error(`  ✗ ${r.id}:`, updErr.message); errors++; }
    else migrated++;
  }
  console.log(`  migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
  return { migrated, skipped, errors };
}

// ── Mini-Step C: breakfast_items ───────────────────────────────────
async function migrateBreakfastItems() {
  console.log('\n─── breakfast_items ────────────────────────────────────');
  const { data: rows, error } = await admin
    .from('breakfast_items')
    .select('id, name_de, name_en, name_fr, name_es, description_de, description_en, description_fr, description_es, name_i18n');
  if (error) { console.error(error); return { migrated: 0, skipped: 0, errors: 1 }; }

  let migrated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (r.name_i18n) { skipped++; continue; }
    const patch = {
      name_i18n:        buildI18n(r.name_de, r.name_en, r.name_fr, r.name_es),
      description_i18n: buildI18n(r.description_de, r.description_en, r.description_fr, r.description_es),
    };
    const { error: updErr } = await admin
      .from('breakfast_items')
      .update(patch)
      .eq('id', r.id);
    if (updErr) { console.error(`  ✗ ${r.id}:`, updErr.message); errors++; }
    else migrated++;
  }
  console.log(`  migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
  return { migrated, skipped, errors };
}

// ── Mini-Step D: eve_knowledge (Row-per-Lang Konsolidierung) ───────
async function migrateEveKnowledge() {
  console.log('\n─── eve_knowledge (Konsolidierung) ─────────────────────');
  // Phase-0-Reality-Check bestätigt: nur DE-Rows existieren.
  // Migration: question/answer DE → question_i18n.de + answer_i18n.de
  const { data: rows, error } = await admin
    .from('eve_knowledge')
    .select('id, language_code, question, answer, question_i18n, answer_i18n');
  if (error) { console.error(error); return { migrated: 0, skipped: 0, errors: 1 }; }

  let migrated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (r.question_i18n || r.answer_i18n) { skipped++; continue; }
    // Sprachcode der Row (meistens 'de') als source-Sprache
    const sourceLang = r.language_code || 'de';
    const patch = {};
    if (r.question) {
      patch.question_i18n = { [sourceLang]: { value: r.question, source: 'original', updated_at: NOW } };
    }
    if (r.answer) {
      patch.answer_i18n = { [sourceLang]: { value: r.answer, source: 'original', updated_at: NOW } };
    }
    if (Object.keys(patch).length === 0) { skipped++; continue; }
    const { error: updErr } = await admin
      .from('eve_knowledge')
      .update(patch)
      .eq('id', r.id);
    if (updErr) { console.error(`  ✗ ${r.id}:`, updErr.message); errors++; }
    else migrated++;
  }
  console.log(`  migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
  return { migrated, skipped, errors };
}

// ── Mini-Step E: hotel_settings + JSONB-Arrays ────────────────────
async function migrateHotelSettings() {
  console.log('\n─── hotel_settings ─────────────────────────────────────');
  const { data: rows, error } = await admin
    .from('hotel_settings')
    .select('hotel_id, welcome_message_de, welcome_message_en, welcome_message_fr, welcome_message_es, hotel_eyebrow_de, hotel_eyebrow_en, hotel_eyebrow_fr, hotel_eyebrow_es, breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es, breakfast_included_de, breakfast_included_en, breakfast_included_fr, breakfast_included_es, conference_rooms, service_items, welcome_message_i18n');
  if (error) { console.error(error); return { migrated: 0, skipped: 0, errors: 1 }; }

  let migrated = 0, skipped = 0, errors = 0;
  for (const r of rows) {
    if (r.welcome_message_i18n) { skipped++; continue; }
    const patch = {
      welcome_message_i18n:    buildI18n(r.welcome_message_de, r.welcome_message_en, r.welcome_message_fr, r.welcome_message_es),
      hotel_eyebrow_i18n:      buildI18n(r.hotel_eyebrow_de, r.hotel_eyebrow_en, r.hotel_eyebrow_fr, r.hotel_eyebrow_es),
      breakfast_location_i18n: buildI18n(r.breakfast_location_de, r.breakfast_location_en, r.breakfast_location_fr, r.breakfast_location_es),
      breakfast_included_i18n: buildI18n(r.breakfast_included_de, r.breakfast_included_en, r.breakfast_included_fr, r.breakfast_included_es),
      conference_rooms: migrateJsonbArray(r.conference_rooms),
      service_items: migrateJsonbArray(r.service_items),
    };
    const { error: updErr } = await admin
      .from('hotel_settings')
      .update(patch)
      .eq('hotel_id', r.hotel_id);
    if (updErr) { console.error(`  ✗ ${r.hotel_id}:`, updErr.message); errors++; }
    else migrated++;
  }
  console.log(`  migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
  return { migrated, skipped, errors };
}

/** Transformiert JSONB-Array-Items: name_de/etc → name_i18n + description_i18n. */
function migrateJsonbArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => {
    if (item.name_i18n) return item; // schon migriert
    const out = { ...item };
    const ni = buildI18n(item.name_de, item.name_en, item.name_fr, item.name_es);
    const di = buildI18n(item.description_de, item.description_en, item.description_fr, item.description_es);
    if (ni) out.name_i18n = ni;
    if (di) out.description_i18n = di;
    return out;
  });
}

// ── Runner ─────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint i18n Phase 3 — Daten-Migration');
console.log(`Filter: ${argTable ?? 'alle Tabellen in Reihenfolge'}`);
console.log('═══════════════════════════════════════════════════════════');

const STEPS = {
  place_picks: migratePlacePicks,
  action_cards: migrateActionCards,
  breakfast_items: migrateBreakfastItems,
  eve_knowledge: migrateEveKnowledge,
  hotel_settings: migrateHotelSettings,
};

const toRun = argTable ? [argTable] : Object.keys(STEPS);
const totals = { migrated: 0, skipped: 0, errors: 0 };
for (const name of toRun) {
  const fn = STEPS[name];
  if (!fn) { console.error(`Unknown table: ${name}`); process.exit(2); }
  const res = await fn();
  totals.migrated += res.migrated;
  totals.skipped  += res.skipped;
  totals.errors   += res.errors;
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`TOTAL  migrated: ${totals.migrated} · skipped: ${totals.skipped} · errors: ${totals.errors}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(totals.errors > 0 ? 1 : 0);
