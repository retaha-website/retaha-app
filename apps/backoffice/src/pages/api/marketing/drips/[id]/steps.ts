// Backoffice · Marketing — Drip-Steps atomar replacen
//
// POST /api/marketing/drips/[id]/steps
// Body: { steps: [{ template_id, delay_days }] }  // step_order = Array-Index + 1
//
// Pattern: replace-all. Delete bestehende Steps + Insert neue. Wenn der Drip
// schon Pässe in marketing_drip_state hat: deren last_step_sent zeigt evtl.
// auf einen Step-Order der nicht mehr existiert. sendOneStep behandelt das:
// "no later step" → completed_at gesetzt. Defensiv robust.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

interface Step { template_id?: string; delay_days?: number; }

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  const dripId = params.id;
  if (!dripId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: { steps?: Step[] };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!Array.isArray(body.steps)) return json({ ok: false, error: 'steps must be array' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const sb = createSupabaseServiceRoleInstance();

  // Verify drip ownership
  const { data: drip } = await sb.from('marketing_drips').select('id, hotel_id').eq('id', dripId).maybeSingle();
  if (!drip || drip.hotel_id !== hotel.id) return json({ ok: false, error: 'drip_not_found' }, 404);

  const steps = body.steps;

  if (steps.length > 0) {
    // Validate all steps have template_id
    const templateIds = steps.map(s => s.template_id).filter((id): id is string => !!id);
    if (templateIds.length !== steps.length) {
      return json({ ok: false, error: 'each step needs template_id' }, 400);
    }

    // Verify templates belong to hotel and are not archived
    const { data: templates } = await sb
      .from('marketing_templates')
      .select('id, hotel_id, is_archived')
      .in('id', templateIds);
    const tplMap = new Map((templates ?? []).map((t: any) => [t.id, t]));
    for (const id of templateIds) {
      const t = tplMap.get(id);
      if (!t || t.hotel_id !== hotel.id) return json({ ok: false, error: `template ${id} not in this hotel` }, 400);
      if (t.is_archived) return json({ ok: false, error: `template ${id} ist archiviert` }, 400);
    }
  }

  // Delete existing steps
  const { error: delErr } = await sb.from('marketing_drip_steps').delete().eq('drip_id', dripId);
  if (delErr) return json({ ok: false, error: 'delete_failed: ' + delErr.message }, 500);

  // Insert new steps
  if (steps.length > 0) {
    const rows = steps.map((s, idx) => ({
      drip_id: dripId,
      template_id: s.template_id,
      delay_days: Math.max(0, Math.floor(s.delay_days ?? 0)),
      step_order: idx + 1,
    }));
    const { error: insErr } = await sb.from('marketing_drip_steps').insert(rows);
    if (insErr) return json({ ok: false, error: 'insert_failed: ' + insErr.message }, 500);
  }

  return json({ ok: true, count: steps.length });
};
