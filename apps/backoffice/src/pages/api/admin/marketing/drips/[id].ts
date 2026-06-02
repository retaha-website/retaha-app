// Sprint Wallet · Phase 14 — Drip-Sequenz Update / Activate-Toggle / Delete
//
// PUT    /api/admin/marketing/drips/[id]    → update name/config/is_active
// DELETE /api/admin/marketing/drips/[id]    → hard delete (cascades zu Steps + State)
//
// Permission: content.write

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadDrip(sb: any, dripId: string, hotelId: string) {
  const { data } = await sb.from('marketing_drips').select('id, hotel_id, trigger_type').eq('id', dripId).maybeSingle();
  if (!data || data.hotel_id !== hotelId) return null;
  return data;
}

export const PUT: APIRoute = async ({ cookies, request, params }) => {
  const dripId = params.id;
  if (!dripId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadDrip(sb, dripId, hotel.id);
  if (!existing) return json({ ok: false, error: 'drip_not_found' }, 404);

  const update: Record<string, any> = {};
  if (typeof body.name === 'string') update.name = body.name.trim();
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
  if (body.trigger_config !== undefined) update.trigger_config = body.trigger_config;
  if (Object.keys(update).length === 0) return json({ ok: false, error: 'nothing_to_update' }, 400);

  const { error } = await sb.from('marketing_drips').update(update).eq('id', dripId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const dripId = params.id;
  if (!dripId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadDrip(sb, dripId, hotel.id);
  if (!existing) return json({ ok: false, error: 'drip_not_found' }, 404);

  // Hard-Delete — cascades zu marketing_drip_steps + marketing_drip_state
  const { error } = await sb.from('marketing_drips').delete().eq('id', dripId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
