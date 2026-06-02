// Sprint Wallet · Phase 14 — Drip-Steps atomar replacen
//
// POST /api/admin/marketing/drips/[id]/steps
// Body: { steps: [{ template_id, delay_days }] }  // step_order = Array-Index + 1
//
// Permission: content.write
//
// Pattern: replace-all. Delete bestehende Steps + Insert neue. Wenn der Drip
// schon Pässe in marketing_drip_state hat: deren last_step_sent zeigt evtl.
// auf einen Step-Order der nicht mehr existiert. In Phase 12 sendOneStep
// behandelt das: "no later step" → completed_at gesetzt. Defensiv robust.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

interface Step { template_id?: string; delay_days?: number; }

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const dripId = params.id;
  if (!dripId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: { steps?: Step[] };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return json({ ok: false, error: 'steps required' }, 400);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const { data: drip } = await sb.from('marketing_drips').select('id, hotel_id').eq('id', dripId).maybeSingle();
  if (!drip || drip.hotel_id !== hotel.id) return json({ ok: false, error: 'drip_not_found' }, 404);

  // Validate steps + Templates gehören zum Hotel
  const templateIds = body.steps.map(s => s.template_id).filter((id): id is string => !!id);
  if (templateIds.length !== body.steps.length) {
    return json({ ok: false, error: 'each step needs template_id' }, 400);
  }
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

  // Delete + Insert atomar — wir haben kein TX-Wrapper in supabase-js, also
  // sequenziell. Wenn Insert failed: alte Steps sind weg. Pragmatik vs Risk:
  // Drip ohne Steps ist visuell "leer", aber harmlos (sendOneStep findet
  // keinen next Step → completed_at).
  const { error: delErr } = await sb.from('marketing_drip_steps').delete().eq('drip_id', dripId);
  if (delErr) return json({ ok: false, error: 'delete_failed: ' + delErr.message }, 500);

  const rows = body.steps.map((s, idx) => ({
    drip_id: dripId,
    template_id: s.template_id,
    delay_days: Math.max(0, Math.floor(s.delay_days ?? 0)),
    step_order: idx + 1,
  }));
  const { error: insErr } = await sb.from('marketing_drip_steps').insert(rows);
  if (insErr) return json({ ok: false, error: 'insert_failed: ' + insErr.message }, 500);

  return json({ ok: true, step_count: rows.length });
};
