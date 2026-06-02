// Sprint H · Group 3 — NFC-Tag Update / Delete
//
// PUT    /api/admin/nfc-tags/[id]    → label / target_value / is_active
// DELETE /api/admin/nfc-tags/[id]    → hard delete
// Permission: settings.write

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../lib/auth';
import { requirePermission } from '../../../../lib/auth/require-permission';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadTagForHotel(sb: any, tagId: string, hotelId: string) {
  const { data } = await sb.from('nfc_tags').select('id, hotel_id, target_type').eq('id', tagId).maybeSingle();
  if (!data || data.hotel_id !== hotelId) return null;
  return data;
}

export const PUT: APIRoute = async ({ cookies, request, params }) => {
  const tagId = params.id;
  if (!tagId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadTagForHotel(sb, tagId, hotel.id);
  if (!existing) return json({ ok: false, error: 'tag_not_found' }, 404);

  const update: Record<string, any> = {};
  if (typeof body.label === 'string') update.label = body.label.trim();
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
  if (body.target_value !== undefined) update.target_value = body.target_value;
  if (Object.keys(update).length === 0) return json({ ok: false, error: 'nothing_to_update' }, 400);

  const { error } = await sb.from('nfc_tags').update(update).eq('id', tagId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const tagId = params.id;
  if (!tagId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadTagForHotel(sb, tagId, hotel.id);
  if (!existing) return json({ ok: false, error: 'tag_not_found' }, 404);

  const { error } = await sb.from('nfc_tags').delete().eq('id', tagId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
