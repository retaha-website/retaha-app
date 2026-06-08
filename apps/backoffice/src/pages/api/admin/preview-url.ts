// GET /api/admin/preview-url
// Gibt eine vollständige Showcase-Session-URL zurück — identisch zur echten Gäste-App.
// Erstellt die Session on-demand (oder gibt bestehende zurück).

import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import { getOrCreateShowcaseUrl } from '../../../lib/demo/get-showcase-url';
import { getUser } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthenticated' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const url = await getOrCreateShowcaseUrl(hotel.id, user.id);
  if (!url) return json({ ok: false, error: 'session_failed' }, 500);

  return json({ ok: true, url });
};
