// Sprint H · Group 2 — Showcase-Session Reset

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { resetShowcaseSession } from '../../../../../lib/showcase/session';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const sessionId = params.id;
  if (!sessionId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const { data: existing } = await sb.from('showcase_sessions').select('id, hotel_id').eq('id', sessionId).maybeSingle();
  if (!existing || existing.hotel_id !== hotel.id) {
    return json({ ok: false, error: 'session_not_found' }, 404);
  }

  const result = await resetShowcaseSession(sessionId);
  return json({ ok: true, ...result });
};
