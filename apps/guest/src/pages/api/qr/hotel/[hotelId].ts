// Sprint E3 Phase 5 — Hotel-weiter QR-Code
//
// Ziel-URL: ${PUBLIC_GUEST_BASE_URL}/g/{token}
//
// Demo-Workaround: nimmt den access_token des ersten aktiven Stays im Hotel.
// Funktioniert solange mindestens 1 Stay aktiv ist. Später kommt ein
// dedizierter Hotel-QR-Token (separate Migration) der unabhängig von Stays
// existiert — bis dahin reicht der Workaround für die Pilot-Demo.
//
// Query-Params:
//   ?format=svg (default) | png
//   ?download=1 → Content-Disposition: attachment

import type { APIRoute } from 'astro';
import { getUser, createSupabaseServerInstance } from '@retaha/auth';
import { buildGuestStayUrl } from '../../../../lib/qr/base-url';
import { generateQrSvg, generateQrPngBuffer } from '../../../../lib/qr/generate';

export const GET: APIRoute = async ({ params, request, url, cookies }) => {
  const { hotelId } = params;
  if (!hotelId) return new Response('Missing hotel ID', { status: 400 });

  const user = await getUser(cookies, request);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const client = createSupabaseServerInstance(cookies, request);

  // RLS-Check via user_hotels — wenn der Hotelier kein Member ist, kommt 0 Rows zurück.
  const { data: membership } = await client
    .from('user_hotels')
    .select('hotel_id')
    .eq('hotel_id', hotelId)
    .maybeSingle();
  if (!membership) return new Response('Forbidden', { status: 403 });

  // First-active-stay-token Workaround
  const { data: stay } = await client
    .from('stays')
    .select('access_token, state')
    .eq('hotel_id', hotelId)
    .in('state', ['Confirmed', 'Started'])
    .not('access_token', 'is', null)
    .order('check_in', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stay?.access_token) {
    return new Response('Kein aktiver Stay mit access_token gefunden', { status: 404 });
  }

  const targetUrl = buildGuestStayUrl(stay.access_token, url);
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
          ...(download ? { 'Content-Disposition': `attachment; filename="hotel-qr-${hotelId}.png"` } : {}),
        },
      });
    }
    const svg = await generateQrSvg(targetUrl, 320);
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...(download ? { 'Content-Disposition': `attachment; filename="hotel-qr-${hotelId}.svg"` } : {}),
      },
    });
  } catch (e) {
    console.error('Hotel-QR generation failed:', e);
    return new Response('QR generation failed', { status: 500 });
  }
};
