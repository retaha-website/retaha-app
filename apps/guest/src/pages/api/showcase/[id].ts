import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { deleteShowcaseSession } from '../../../lib/showcase/session';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const sessionId = params.id;
  if (!sessionId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const result = await deleteShowcaseSession(sessionId, hotel.id);
  if ('error' in result) return json({ ok: false, error: result.error }, 500);
  return json({ ok: true });
};
