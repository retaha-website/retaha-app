// Sprint Wallet · Phase 10 — Campaign-Scheduling + Cancel
//
// POST /api/admin/marketing/campaigns/[id]/schedule
//   Body: { scheduled_at: ISO } → wechselt status auf 'scheduled'
//
// DELETE /api/admin/marketing/campaigns/[id]/schedule
//   Cancelt eine geplante Campaign (status='cancelled') — nur aus
//   draft|scheduled erlaubt. 'sending' ist Lock-State und nicht abbrechbar
//   (würde Race-Conditions im Run produzieren).
//
// Permission: content.write

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadCampaign(sb: any, campaignId: string, hotelId: string) {
  const { data } = await sb
    .from('marketing_campaigns')
    .select('id, hotel_id, status')
    .eq('id', campaignId)
    .maybeSingle();
  if (!data || data.hotel_id !== hotelId) return null;
  return data;
}

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const campaignId = params.id;
  if (!campaignId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: { scheduled_at?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  if (!body.scheduled_at) return json({ ok: false, error: 'missing_scheduled_at' }, 400);
  const t = Date.parse(body.scheduled_at);
  if (!Number.isFinite(t)) return json({ ok: false, error: 'invalid_scheduled_at' }, 400);
  if (t <= Date.now() + 60_000) {
    return json({ ok: false, error: 'scheduled_at_must_be_future' }, 400);
  }

  const sb = createSupabaseServiceRoleInstance();
  const c = await loadCampaign(sb, campaignId, hotel.id);
  if (!c) return json({ ok: false, error: 'campaign_not_found' }, 404);
  if (!['draft', 'scheduled'].includes(c.status)) {
    return json({ ok: false, error: 'campaign_not_schedulable', current_status: c.status }, 409);
  }

  const { error } = await sb.from('marketing_campaigns').update({
    status: 'scheduled',
    scheduled_at: new Date(t).toISOString(),
    send_error: null,
  }).eq('id', campaignId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: 'scheduled' });
};

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const campaignId = params.id;
  if (!campaignId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const c = await loadCampaign(sb, campaignId, hotel.id);
  if (!c) return json({ ok: false, error: 'campaign_not_found' }, 404);
  if (!['draft', 'scheduled'].includes(c.status)) {
    return json({ ok: false, error: 'campaign_not_cancellable', current_status: c.status }, 409);
  }

  const { error } = await sb.from('marketing_campaigns').update({
    status: 'cancelled',
  }).eq('id', campaignId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: 'cancelled' });
};
