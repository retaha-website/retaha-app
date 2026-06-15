// Backoffice · Marketing — Campaign-Scheduling + Cancel
//
// DELETE /api/marketing/campaigns/[id]/schedule
//   Cancelt eine geplante Campaign (status='cancelled') — nur aus
//   draft|scheduled erlaubt. 'sending' ist Lock-State und nicht abbrechbar
//   (würde Race-Conditions im Run produzieren).

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

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

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const campaignId = params.id;
  if (!campaignId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const sb = createSupabaseServiceRoleInstance();
  const c = await loadCampaign(sb, campaignId, hotel.id);
  if (!c) return json({ ok: false, error: 'campaign_not_found' }, 404);
  if (!['draft', 'scheduled'].includes(c.status)) {
    return json({ ok: false, error: 'campaign_not_cancellable', current_status: c.status }, 409);
  }

  const { error } = await sb.from('marketing_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', campaignId)
    .eq('hotel_id', hotel.id)
    .in('status', ['draft', 'scheduled']);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: 'cancelled' });
};
