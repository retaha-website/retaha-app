// Sprint E3 Phase 5 — Pro-Zimmer-QR-Code
//
// Ziel-URL: ${PUBLIC_GUEST_BASE_URL}/g/r/{room_code}
//
// room_code-Pairing aus Sprint D Phase 3. Gast scannt → /g/r/{code} →
// auto-pair mit aktivem Stay im Zimmer → Holzkarten-Flow.
//
// Demo-Hotel hat aktuell 0 rooms (Mews-Room-Bug, Backlog) → /app/qr zeigt
// dann Empty-State + Hinweis. Endpoint selbst wirft sauberes 404 falls
// room_code nicht existiert.
//
// Query-Params:
//   ?format=svg (default) | png
//   ?download=1 → Content-Disposition: attachment

import type { APIRoute } from 'astro';
import { getUser, createSupabaseServerInstance } from '@retaha/auth';
import { buildGuestRoomUrl } from '../../../../lib/qr/base-url';
import { generateQrSvg, generateQrPngBuffer } from '../../../../lib/qr/generate';

export const GET: APIRoute = async ({ params, request, url, cookies }) => {
  const { roomCode } = params;
  if (!roomCode) return new Response('Missing room code', { status: 400 });

  const user = await getUser(cookies, request);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const client = createSupabaseServerInstance(cookies, request);

  // RLS-protected: rooms-Tabelle hat user_hotel_ids()-Policy → Hotelier sieht
  // nur Räume seiner Hotels, andere → 0 Rows.
  const { data: room } = await client
    .from('rooms')
    .select('id, hotel_id, room_code, is_active')
    .eq('room_code', roomCode)
    .maybeSingle();
  if (!room) return new Response('Zimmer nicht gefunden', { status: 404 });

  const targetUrl = buildGuestRoomUrl(room.room_code, url);
  const format = (url.searchParams.get('format') || 'svg').toLowerCase();
  const download = url.searchParams.get('download') === '1';

  try {
    if (format === 'png') {
      const buf = await generateQrPngBuffer(targetUrl, 600);
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...(download ? { 'Content-Disposition': `attachment; filename="room-qr-${roomCode}.png"` } : {}),
        },
      });
    }
    const svg = await generateQrSvg(targetUrl, 320);
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...(download ? { 'Content-Disposition': `attachment; filename="room-qr-${roomCode}.svg"` } : {}),
      },
    });
  } catch (e) {
    console.error('Room-QR generation failed:', e);
    return new Response('QR generation failed', { status: 500 });
  }
};
