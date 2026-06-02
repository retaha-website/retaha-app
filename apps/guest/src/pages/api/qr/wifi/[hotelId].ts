import type { APIRoute } from 'astro';
import QRCode from 'qrcode';
import { createServerClient } from '@retaha/db';

export const GET: APIRoute = async ({ params }) => {
  const { hotelId } = params;
  if (!hotelId) {
    return new Response('Missing hotel ID', { status: 400 });
  }

  const supabase = createServerClient();
  const { data: settings, error } = await supabase
    .from('hotel_settings')
    .select('wifi_ssid, wifi_password')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (error || !settings) {
    return new Response('Hotel not found', { status: 404 });
  }

  const ssid = settings.wifi_ssid || 'Gate-Guest';
  const password = settings.wifi_password || '';

  // Escape special chars per WiFi QR spec (RFC https://github.com/zxing/zxing/wiki/Barcode-Contents)
  const escape = (s: string) => s.replace(/([\\;,":])/g, '\\$1');
  const wifiString = `WIFI:T:WPA;S:${escape(ssid)};P:${escape(password)};;`;

  try {
    // Generate SVG with retaha colors
    const svg = await QRCode.toString(wifiString, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: {
        dark: '#1A1A1A',
        light: '#FFFFFF',
      },
    });

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (e) {
    console.error('QR generation failed:', e);
    return new Response('QR generation failed', { status: 500 });
  }
};
