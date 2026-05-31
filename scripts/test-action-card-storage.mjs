// Sprint E7 Phase 2 — Storage-Verifikation
//
// Tests:
//   1. Test-Upload (1×1 PNG) → URL ladbar?
//   2. Delete → URL nicht mehr ladbar?
//   3. MIME-Reject (.pdf-Buffer mit application/pdf) → Reject?
//   4. Size-Reject (3 MB Buffer) → Reject?
//
// Run: node --env-file=.env scripts/test-action-card-storage.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'action-card-images';
const TEST_HOTEL = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const TEST_CARD = 'phase2-test-card';

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint E7 Phase 2 — Storage Verifikation');
console.log('═══════════════════════════════════════════════════════════');

// 1×1 transparent PNG (smallest valid PNG)
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);

let pass = 0, fail = 0;
function check(name, ok, detail) {
  const sym = ok ? '✓' : '✗';
  console.log(`${sym} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

// ── Test 1: Upload PNG ───────────────────────────────────────────────
const pngPath = `${TEST_HOTEL}/${TEST_CARD}.png`;
const upload1 = await admin.storage.from(BUCKET).upload(pngPath, PNG_1x1, {
  contentType: 'image/png', upsert: true, cacheControl: '3600',
});
check('Upload 1×1 PNG', !upload1.error, upload1.error?.message);

if (!upload1.error) {
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(pngPath);
  const fullUrl = `${pub.publicUrl}?v=${Date.now()}`;
  console.log('  → URL:', fullUrl);

  // Fetch URL to verify it's publicly reachable
  const res = await fetch(fullUrl);
  check('Public URL reachable', res.ok && res.headers.get('content-type')?.includes('image'),
        `HTTP ${res.status}, content-type=${res.headers.get('content-type')}`);
}

// ── Test 2: MIME-Reject ──────────────────────────────────────────────
const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
const pdfUpload = await admin.storage.from(BUCKET).upload(
  `${TEST_HOTEL}/${TEST_CARD}-bad.pdf`,
  pdfBuffer,
  { contentType: 'application/pdf', upsert: true },
);
check('MIME-Reject (application/pdf)', !!pdfUpload.error,
      pdfUpload.error?.message ?? 'UPLOAD UNEXPECTEDLY SUCCEEDED!');

// ── Test 3: Size-Reject (3 MB > 2 MB Limit) ──────────────────────────
const bigBuffer = Buffer.alloc(3 * 1024 * 1024, 0xff);
const bigUpload = await admin.storage.from(BUCKET).upload(
  `${TEST_HOTEL}/${TEST_CARD}-big.jpg`,
  bigBuffer,
  { contentType: 'image/jpeg', upsert: true },
);
check('Size-Reject (3 MB > 2 MB)', !!bigUpload.error,
      bigUpload.error?.message ?? 'UPLOAD UNEXPECTEDLY SUCCEEDED!');

// ── Test 4: Delete ───────────────────────────────────────────────────
const del = await admin.storage.from(BUCKET).remove([pngPath]);
check('Delete PNG', !del.error, del.error?.message);

if (!del.error) {
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(pngPath);
  const res = await fetch(pub.publicUrl);
  check('URL not reachable after delete', res.status === 400 || res.status === 404,
        `HTTP ${res.status}`);
}

console.log('───────────────────────────────────────────────────────────');
console.log(`Passed: ${pass} · Failed: ${fail}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
