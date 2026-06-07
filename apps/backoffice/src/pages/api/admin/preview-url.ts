// GET /api/admin/preview-url
// Generiert einen frischen, signierten Preview-Token für die aktuelle Design-Identität
// des Hotels und gibt die URL zur echten Gäste-App zurück.
// Kein DB-Write — rein HMAC-signiert, TTL 30 Tage.

import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { createPreviewToken } from '../../../lib/preview/preview-token';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_IDENTITIES = new Set(['classic', 'bauhaus', 'editorial', 'maison']);

export const GET: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  // Optionaler ?identity=X Parameter (z.B. aus ThemeSection)
  const url = new URL(request.url);
  const identityParam = url.searchParams.get('identity');

  let identity: string;
  if (identityParam && VALID_IDENTITIES.has(identityParam)) {
    identity = identityParam;
  } else {
    // Aktuelle Design-Identität des Hotels aus DB
    const sb = createSupabaseServiceRoleInstance();
    const { data } = await sb
      .from('hotels')
      .select('design_identity')
      .eq('id', hotel.id)
      .single();
    identity = (data as any)?.design_identity ?? 'bauhaus';
    if (!VALID_IDENTITIES.has(identity)) identity = 'bauhaus';
  }

  const token = createPreviewToken(hotel.id, identity);
  const domain = import.meta.env.RETAHA_DOMAIN ?? 'retaha.de';
  const slug   = hotel.slug ?? null;
  const base   = slug ? `https://${slug}.${domain}` : `https://app.${domain}`;
  const previewUrl = `${base}/g/preview?t=${token}`;

  return json({ ok: true, url: previewUrl, identity });
};
