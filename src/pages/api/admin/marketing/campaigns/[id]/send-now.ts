// Sprint Wallet · Phase 10 — Campaign sofort senden
//
// POST /api/admin/marketing/campaigns/[id]/send-now
// Permission: content.write
//
// Body: keiner. Endpoint blockiert bis Send fertig (sequenziell Pass-by-Pass).
// Bei vielen Pässen ist das lang — siehe Hinweis "Cron statt sofort" für
// Production.

import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '../../../../../../lib/auth';
import { requirePermission } from '../../../../../../lib/auth/require-permission';
import { runCampaignSend } from '../../../../../../lib/marketing/send';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const campaignId = params.id;
  if (!campaignId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

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
