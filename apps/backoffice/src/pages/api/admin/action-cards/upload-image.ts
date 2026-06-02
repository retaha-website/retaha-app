// Sprint E7 Phase 3 — Action-Card image upload
//
// POST multipart/form-data: { card_id, image }
// Returns: { ok, image_url, error?, reason? }
//
// Wird vom Editor nach Upsert aufgerufen (zweistufig):
//   1. /upsert → cardId
//   2. /upload-image (cardId, file) → public URL, schreibt image_url in DB

import type { APIRoute } from 'astro';
import {
  getUser, getUserHotels,
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';
import {
  uploadActionCardImage,
  ActionCardImageError,
} from '../../../../lib/storage/action-card-images';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel' }, 403);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ ok: false, error: 'Invalid form-data' }, 400); }

  const cardId = form.get('card_id')?.toString();
  const file = form.get('image');
  if (!cardId) return json({ ok: false, error: 'Missing card_id' }, 400);
  if (!(file instanceof File)) return json({ ok: false, error: 'Missing image' }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  // Ownership-Check
  const { data: card } = await sb
    .from('hotel_action_cards')
    .select('id')
    .eq('id', cardId)
    .eq('hotel_id', hotel.id)
    .maybeSingle();
  if (!card) return json({ ok: false, error: 'Card not found or forbidden' }, 404);

  const admin = createSupabaseServiceRoleInstance();
  let imageUrl: string;
  try {
    imageUrl = await uploadActionCardImage(admin, hotel.id, cardId, file);
  } catch (err) {
    if (err instanceof ActionCardImageError) {
      return json({ ok: false, error: err.message, reason: err.reason }, 400);
    }
    return json({ ok: false, error: (err as Error).message, reason: 'unknown' }, 500);
  }

  const { error: updErr } = await sb
    .from('hotel_action_cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId)
    .eq('hotel_id', hotel.id);
  if (updErr) return json({ ok: false, error: updErr.message, reason: 'db_update' }, 500);

  return json({ ok: true, image_url: imageUrl });
};
