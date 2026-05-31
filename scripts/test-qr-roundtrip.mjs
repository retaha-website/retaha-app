// Sprint E3 Phase 5 — QR-Scan-Test
//
// Verifiziert dass der QR-Code, den die Endpoints generieren, beim Scannen
// die korrekte Gast-Frontend-URL liefert. Round-trip:
//   1. Baut URL via base-url-Logik
//   2. Generiert PNG mit derselben qrcode-Lib wie der Endpoint
//   3. Decoded das PNG mit jsqr (wenn vorhanden) oder rendert ASCII-Terminal-QR
//
// Run: node scripts/test-qr-roundtrip.mjs
import QRCode from 'qrcode';

const PUBLIC_GUEST_BASE_URL = process.env.PUBLIC_GUEST_BASE_URL || 'http://localhost:4321';
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const DEMO_TOKEN = 'A3sAi51obggAQBHgDorlhdPOJIdsV4vV';
const DEMO_ROOM_CODE = 'GG-101-DEMO';

function buildGuestStayUrl(token) {
  return `${PUBLIC_GUEST_BASE_URL.replace(/\/+$/, '')}/g/${encodeURIComponent(token)}`;
}
function buildGuestRoomUrl(roomCode) {
  return `${PUBLIC_GUEST_BASE_URL.replace(/\/+$/, '')}/g/r/${encodeURIComponent(roomCode)}`;
}

const COMMON = {
  errorCorrectionLevel: 'M',
  margin: 1,
  color: { dark: '#1A1A1A', light: '#FFFFFF' },
};

const hotelUrl = buildGuestStayUrl(DEMO_TOKEN);
const roomUrl = buildGuestRoomUrl(DEMO_ROOM_CODE);

console.log('═══════════════════════════════════════════════════════════');
console.log('Sprint E3 Phase 5 — QR-Scan-Test');
console.log('═══════════════════════════════════════════════════════════');
console.log('PUBLIC_GUEST_BASE_URL :', PUBLIC_GUEST_BASE_URL);
console.log('Hotel-QR Ziel-URL    :', hotelUrl);
console.log('Room-QR  Ziel-URL    :', roomUrl);
console.log('');

// jsqr decode für ehrlichen Scan-Test (wenn verfügbar)
let jsqr = null;
try { jsqr = (await import('jsqr')).default; } catch {}

if (jsqr) {
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch {}
  if (sharp) {
    for (const [label, url] of [['Hotel', hotelUrl], ['Room', roomUrl]]) {
      const png = await QRCode.toBuffer(url, { type: 'png', width: 400, ...COMMON });
      const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const decoded = jsqr(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height);
      const ok = decoded?.data === url;
      console.log(`${label}-QR decode: ${ok ? '✓ MATCH' : '✗ MISMATCH'} (got: ${decoded?.data ?? 'null'})`);
    }
  } else {
    console.log('(sharp nicht installiert — skip PNG-Decode-Test)');
  }
} else {
  console.log('(jsqr nicht installiert — skip Decode-Test)');
}

console.log('');
console.log('─── Hotel-QR (Terminal-ASCII, mit Phone scannen) ──────────');
console.log(await QRCode.toString(hotelUrl, { type: 'terminal', small: true, errorCorrectionLevel: 'M' }));
console.log('Erwartet beim Scan: ', hotelUrl);
console.log('═══════════════════════════════════════════════════════════');
