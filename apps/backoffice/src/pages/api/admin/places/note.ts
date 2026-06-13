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

  const id = typeof body.id === 'string' ? body.id.trim() : null;
  const note = typeof body.note === 'string' ? body.note.trim() : null;
  if (!id) return json({ ok: false, error: 'id required' }, 400);

  const supabase = createSupabaseServiceRoleInstance();
  const { error } = await supabase
    .from('hotel_place_picks')
    .update({ hotel_note: note || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    console.error('[places/note PATCH]', error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
