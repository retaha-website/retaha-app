import type { APIRoute } from 'astro';
import { getUserHotels, requirePermission } from '@retaha/auth';
import { updateShowcaseSession } from '../../../../lib/showcase/session';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const PATCH: APIRoute = async ({ cookies, request, params }) => {
  const sessionId = params.id;
  if (!sessionId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  let body: { demo_data?: any };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  if (!body.demo_data) return json({ ok: false, error: 'missing_demo_data' }, 400);

  const result = await updateShowcaseSession({
    sessionId,
    hotelId: hotel.id,
    demoData: body.demo_data,
  });
  if ('error' in result) return json({ ok: false, error: result.error }, 500);
  return json({ ok: true, session: result });
};
