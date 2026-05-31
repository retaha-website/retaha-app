// Sprint E7 Phase 1 — Daten-Migration:
//   hotel_settings.recommendations JSONB → hotel_action_cards (relational)
//
// Idempotent: prüft pro Hotel ob bereits Cards in hotel_action_cards existieren.
// Wenn ja → skip (kein doppeltes Anlegen bei Re-Run).
//
// Feld-Mapping JSONB → Tabelle:
//   id (garden/conference/wallet)     → keine direkte Spalte, geht in sort_order via array-Index
//   action (open_breakfast/...)       → action_target (card_type='internal_action')
//   card_class                        → card_class
//   title_de/en/fr/es                 → title_de/en/fr/es
//   sub_de/en/fr/es                   → subtitle_de/en/fr/es   ← Naming-Wechsel
//   eyebrow_de/en/fr/es               → eyebrow_de/en/fr/es
//   cta_de/en/fr/es                   → cta_de/en/fr/es
//
// Alte hotel_settings.recommendations bleibt unverändert (Fallback bis
// Phase 4 verifiziert; Cleanup in Phase 5).
//
// Run: node --env-file=.env scripts/migrate-recommendations-to-action-cards.mjs
//      (braucht SUPABASE_SERVICE_ROLE_KEY in .env, Node ≥20.6)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint E7 Phase 1 — Migrate recommendations → action_cards');
console.log('═══════════════════════════════════════════════════════════');

const { data: settings, error: settingsErr } = await admin
  .from('hotel_settings')
  .select('hotel_id, recommendations');
if (settingsErr) { console.error('settings query failed:', settingsErr); process.exit(1); }

let migrated = 0, skipped = 0, totalCards = 0, errors = 0;

for (const row of settings) {
  const { hotel_id, recommendations } = row;
  const recs = Array.isArray(recommendations) ? recommendations : [];

  if (recs.length === 0) {
    console.log(`· hotel ${hotel_id}: 0 recommendations → skip`);
    skipped++;
    continue;
  }

  // Idempotenz-Check: Hotel hat schon Cards? → skip
  const { count, error: countErr } = await admin
    .from('hotel_action_cards')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotel_id);
  if (countErr) { console.error(`  count failed for ${hotel_id}:`, countErr); errors++; continue; }
  if ((count ?? 0) > 0) {
    console.log(`· hotel ${hotel_id}: ${count} action_cards bereits vorhanden → skip (idempotent)`);
    skipped++;
    continue;
  }

  // Map array → rows
  const cardRows = recs.map((rec, idx) => ({
    hotel_id,
    card_type: 'internal_action',
    action_target: rec.action ?? null,
    title_de:    rec.title_de    ?? rec.title    ?? '(ohne Titel)',
    title_en:    rec.title_en    ?? null,
    title_fr:    rec.title_fr    ?? null,
    title_es:    rec.title_es    ?? null,
    subtitle_de: rec.sub_de      ?? null,
    subtitle_en: rec.sub_en      ?? null,
    subtitle_fr: rec.sub_fr      ?? null,
    subtitle_es: rec.sub_es      ?? null,
    eyebrow_de:  rec.eyebrow_de  ?? null,
    eyebrow_en:  rec.eyebrow_en  ?? null,
    eyebrow_fr:  rec.eyebrow_fr  ?? null,
    eyebrow_es:  rec.eyebrow_es  ?? null,
    cta_de:      rec.cta_de      ?? null,
    cta_en:      rec.cta_en      ?? null,
    cta_fr:      rec.cta_fr      ?? null,
    cta_es:      rec.cta_es      ?? null,
    image_url:   null,
    card_class:  rec.card_class  ?? 'rec-anthrazit',
    is_published: true,
    sort_order:  idx,
  }));

  const { error: insertErr } = await admin
    .from('hotel_action_cards')
    .insert(cardRows);

  if (insertErr) {
    console.error(`  ✗ insert failed for ${hotel_id}:`, insertErr.message);
    errors++;
    continue;
  }

  console.log(`✓ hotel ${hotel_id}: ${cardRows.length} cards migrated (${cardRows.map(c => c.action_target).join(', ')})`);
  migrated++;
  totalCards += cardRows.length;
}

console.log('───────────────────────────────────────────────────────────');
console.log(`Hotels migrated: ${migrated} · skipped: ${skipped} · errors: ${errors}`);
console.log(`Total cards inserted: ${totalCards}`);
console.log('═══════════════════════════════════════════════════════════');

process.exit(errors > 0 ? 1 : 0);
