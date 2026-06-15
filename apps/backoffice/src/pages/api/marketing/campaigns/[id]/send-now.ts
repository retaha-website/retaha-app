// Backoffice · Marketing — Campaign sofort senden
//
// POST /api/marketing/campaigns/[id]/send-now
//
// Keine Body-Parameter. Blockiert bis Send fertig (sequenziell Pass-by-Pass).

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { runCampaignSend } from '@retaha/marketing';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const campaignId = params.id;
  if (!campaignId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  // Ownership-Check: Campaign muss zu diesem Hotel gehören
  const sb = createSupabaseServiceRoleInstance();
  const { data: c } = await sb
    .from('marketing_campaigns')
    .select('id, hotel_id, status')
    .eq('id', campaignId)
    .maybeSingle();
  if (!c || c.hotel_id !== hotel.id) {
    return json({ ok: false, error: 'campaign_not_found' }, 404);
  }
  if (!['draft', 'scheduled'].includes(c.status)) {
    return json({ ok: false, error: 'campaign_not_sendable', current_status: c.status }, 409);
  }

  const result = await runCampaignSend(campaignId);
  return json(result, result.ok ? 200 : 500);
};
