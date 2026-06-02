// Sprint H · Group 2 — Showcase-Session erstellen
//
// POST /api/admin/showcase/create
// Body: { ttl_days?, demo_data? }
// Permission: settings.write

import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { createShowcaseSession } from '../../../../lib/showcase/session';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: { ttl_days?: number; demo_data?: any };
  try { body = await request.json(); } catch { body = {}; }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const result = await createShowcaseSession({
    hotelId: hotel.id,
    createdBy: auth.userId,
    ttlDays: typeof body.ttl_days === 'number' && body.ttl_days > 0 ? Math.min(body.ttl_days, 365) : undefined,
    demoData: body.demo_data,
  });
  if ('error' in result) return json({ ok: false, error: result.error }, 500);
  return json({ ok: true, session: result });
};
