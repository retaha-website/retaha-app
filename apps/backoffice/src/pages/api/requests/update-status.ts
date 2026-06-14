import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false }, 401);

  let body: { id?: string; status?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false }, 400); }

  if (!body.id || !['open','seen','done'].includes(body.status ?? '')) {
    return json({ ok: false }, 400);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotelIds = (hotels ?? []).map((h: any) => h.hotel?.id).filter(Boolean);

  const sbSr = createSupabaseServiceRoleInstance();

  // Verify ownership before update
  const { data: req } = await sbSr
    .from('stay_requests')
    .select('hotel_id')
    .eq('id', body.id)
    .maybeSingle();

  if (!req || !hotelIds.includes(req.hotel_id)) return json({ ok: false }, 403);

  const { error } = await sbSr
    .from('stay_requests')
    .update({ status: body.status })
    .eq('id', body.id);

  if (error) return json({ ok: false }, 500);
  return json({ ok: true });
};
