import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

export const PATCH: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const ids: unknown[] = body.ids as unknown[];
  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ ok: false, error: 'ids array required' }, 400);
  }

  const supabase = createSupabaseServiceRoleInstance();
  const results = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from('hotel_place_picks')
        .update({ sort_order: idx })
        .eq('id', id)
        .eq('hotel_id', hotel.id),
    ),
  );

  const failed = results.find(r => r.error);
  if (failed?.error) {
    console.error('[places/reorder PATCH]', failed.error);
    return json({ ok: false, error: failed.error.message }, 500);
  }

  return json({ ok: true });
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
