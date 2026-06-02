// Sprint E7 Phase 3 — Action-Card delete (+ Image-Cleanup)
//
// POST JSON: { id }
// Returns: { ok, image_cleanup: { attempted, error? } }

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { deleteActionCardImage, ActionCardImageError } from '../../../../lib/storage/action-card-images';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel' }, 403);

  let body: { id?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  if (!body.id) return json({ ok: false, error: 'Missing id' }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  // RLS-Delete (returns deleted rows in select())
  const { data: deleted, error } = await sb
    .from('hotel_action_cards')
    .delete()
    .eq('id', body.id)
    .eq('hotel_id', hotel.id)
    .select('id, image_url');
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!deleted || deleted.length === 0) return json({ ok: false, error: 'Not found or forbidden' }, 404);

  // Image-Cleanup (best-effort, niemals den DELETE blockieren)
  let imageCleanup: { attempted: boolean; error?: string } = { attempted: false };
  if (deleted[0].image_url) {
    imageCleanup.attempted = true;
    try {
      const admin = createSupabaseServiceRoleInstance();
      await deleteActionCardImage(admin, hotel.id, body.id);
    } catch (err) {
      const reason = err instanceof ActionCardImageError ? err.reason : 'unknown';
      console.warn(`[action-cards/delete] image cleanup failed for ${body.id}:`, reason);
      imageCleanup.error = reason;
    }
  }

  return json({ ok: true, image_cleanup: imageCleanup });
};
