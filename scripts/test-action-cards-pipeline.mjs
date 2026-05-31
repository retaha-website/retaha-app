// Sprint E7 Phase 3 — End-to-End-Pipeline-Test
//
// Simuliert die 4 API-Endpoints rein über DB + Storage (Service-Role).
// Browser-Klick-Tests macht der User separat im Backoffice.
//
// Test-Flow (idempotent — cleant sich am Ende):
//   1. CREATE: external_link Card mit Test-URL → sort_order = max+1
//   2. UPLOAD: 1×1 PNG zur neuen Card → image_url gesetzt
//   3. SORT:   Swap mit Vor-Card → sort_order Tausch verifiziert
//   4. UPDATE: Title ändern + ein zweites Sprach-Set
//   5. DELETE: Card + Image cleanup
//   6. ASSERT: nach Cleanup → Card weg, image nicht mehr ladbar
//
// Run: node --env-file=.env scripts/test-action-cards-pipeline.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const BUCKET = 'action-card-images';
const TEST_URL = 'https://booking.gate-garden.de/test';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint E7 Phase 3 — End-to-End-Pipeline-Test');
console.log('═══════════════════════════════════════════════════════════');

// Pre-State
const { count: countBefore } = await admin
  .from('hotel_action_cards')
  .select('*', { count: 'exact', head: true })
  .eq('hotel_id', HOTEL);
console.log(`Pre: ${countBefore} cards im Demo-Hotel`);

// ── 1. CREATE ────────────────────────────────────────────────────────
const { data: maxRow } = await admin
  .from('hotel_action_cards')
  .select('sort_order')
  .eq('hotel_id', HOTEL)
  .order('sort_order', { ascending: false })
  .limit(1)
  .maybeSingle();
const nextOrder = (maxRow?.sort_order ?? -1) + 1;

const { data: created, error: createErr } = await admin
  .from('hotel_action_cards')
  .insert({
    hotel_id: HOTEL,
    card_type: 'external_link',
    action_target: TEST_URL,
    title_de: 'Test-Konferenz buchen',
    title_en: 'Book test conference',
    subtitle_de: 'Direkt-Buchungstool — keine Provision.',
    eyebrow_de: 'Sprint E7 Phase 3',
    cta_de: 'Zur Buchung',
    card_class: 'rec-pink',
    is_published: true,
    sort_order: nextOrder,
  })
  .select('*')
  .single();
check('CREATE external_link card', !createErr, createErr?.message);
if (createErr) process.exit(1);
const cardId = created.id;
console.log(`  → card_id: ${cardId}, sort_order: ${created.sort_order}`);

// ── 2. UPLOAD image ──────────────────────────────────────────────────
const imgPath = `${HOTEL}/${cardId}.png`;
const upload = await admin.storage.from(BUCKET).upload(imgPath, PNG_1x1, {
  contentType: 'image/png', upsert: true, cacheControl: '3600',
});
check('UPLOAD image', !upload.error, upload.error?.message);

const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(imgPath);
const imgUrl = `${pub.publicUrl}?v=${Date.now()}`;
const { error: imgUpdErr } = await admin
  .from('hotel_action_cards')
  .update({ image_url: imgUrl })
  .eq('id', cardId);
check('UPDATE image_url in DB', !imgUpdErr, imgUpdErr?.message);

const fetchImg = await fetch(imgUrl);
check('image_url reachable', fetchImg.ok, `HTTP ${fetchImg.status}`);

// ── 3. SORT (Tausch mit vorheriger Card) ─────────────────────────────
if (created.sort_order > 0) {
  const { data: prev } = await admin
    .from('hotel_action_cards')
    .select('id, sort_order')
    .eq('hotel_id', HOTEL)
    .eq('sort_order', created.sort_order - 1)
    .single();

  const upd1 = await admin.from('hotel_action_cards').update({ sort_order: prev.sort_order }).eq('id', cardId);
  const upd2 = await admin.from('hotel_action_cards').update({ sort_order: created.sort_order }).eq('id', prev.id);
  check('SORT swap', !upd1.error && !upd2.error);

  const { data: verify } = await admin
    .from('hotel_action_cards')
    .select('sort_order')
    .eq('id', cardId)
    .single();
  check('SORT verified', verify.sort_order === prev.sort_order, `now sort_order=${verify.sort_order}`);

  // revert für sauberes cleanup
  await admin.from('hotel_action_cards').update({ sort_order: created.sort_order }).eq('id', cardId);
  await admin.from('hotel_action_cards').update({ sort_order: prev.sort_order }).eq('id', prev.id);
}

// ── 4. UPDATE ────────────────────────────────────────────────────────
const { error: updErr } = await admin
  .from('hotel_action_cards')
  .update({ title_de: 'Test-Konferenz (geändert)', title_fr: 'Conférence test' })
  .eq('id', cardId);
check('UPDATE title_de + add title_fr', !updErr, updErr?.message);

// ── 5. DELETE + image cleanup ────────────────────────────────────────
await admin.storage.from(BUCKET).remove([imgPath]);
const { error: delErr } = await admin
  .from('hotel_action_cards')
  .delete()
  .eq('id', cardId);
check('DELETE card', !delErr, delErr?.message);

const fetchImgAfter = await fetch(imgUrl.split('?')[0]); // ohne Cache-Buster
check('image not reachable after delete', fetchImgAfter.status >= 400, `HTTP ${fetchImgAfter.status}`);

// Post-State
const { count: countAfter } = await admin
  .from('hotel_action_cards')
  .select('*', { count: 'exact', head: true })
  .eq('hotel_id', HOTEL);
check('Card count restored', countAfter === countBefore, `before=${countBefore} after=${countAfter}`);

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
