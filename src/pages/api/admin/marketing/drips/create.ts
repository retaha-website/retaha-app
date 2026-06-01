// Sprint Wallet · Phase 14 — Drip-Sequenz anlegen
//
// POST /api/admin/marketing/drips/create
// Permission: content.write
// Body: { name, trigger_type, trigger_config?, is_active?, steps?: [{template_id, delay_days}] }

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../../lib/auth';
import { requirePermission } from '../../../../../lib/auth/require-permission';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_TRIGGERS = new Set([
  'wallet_add', 'first_visit', 'checkout', 'anniversary',
  'visit_count_milestone', 'seasonal',
]);

interface StepInput { template_id?: string; delay_days?: number; }

interface Body {
  name?: string;
  trigger_type?: string;
  trigger_config?: any;
  is_active?: boolean;
  steps?: StepInput[];
}

function validateTriggerConfig(triggerType: string, config: any): { ok: true } | { ok: false; error: string } {
  if (triggerType === 'visit_count_milestone') {
    if (!config || !Array.isArray(config.milestones) || config.milestones.length === 0) {
      return { ok: false, error: 'visit_count_milestone braucht trigger_config.milestones: [number, ...]' };
    }
    if (!config.milestones.every((m: any) => Number.isInteger(m) && m > 0)) {
      return { ok: false, error: 'milestones müssen positive Ganzzahlen sein' };
    }
  } else if (triggerType === 'seasonal') {
    if (!config || !Number.isInteger(config.month) || !Number.isInteger(config.day)) {
      return { ok: false, error: 'seasonal braucht trigger_config: { month: 1..12, day: 1..31 }' };
    }
    if (config.month < 1 || config.month > 12) return { ok: false, error: 'month muss 1-12 sein' };
    if (config.day < 1 || config.day > 31) return { ok: false, error: 'day muss 1-31 sein' };
  }
  return { ok: true };
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: Body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const name = body.name?.toString().trim();
  const triggerType = body.trigger_type?.toString();
  if (!name) return json({ ok: false, error: 'missing_name' }, 400);
  if (!triggerType || !VALID_TRIGGERS.has(triggerType)) return json({ ok: false, error: 'invalid_trigger_type' }, 400);

  const cfgCheck = validateTriggerConfig(triggerType, body.trigger_config);
  if (!cfgCheck.ok) return json({ ok: false, error: cfgCheck.error }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();

  const { data: drip, error: dripErr } = await sb.from('marketing_drips').insert({
    hotel_id: hotel.id,
    name,
    trigger_type: triggerType,
    trigger_config: body.trigger_config ?? null,
    is_active: body.is_active === true,
    created_by: auth.userId,
  }).select('id').single();

  if (dripErr || !drip) return json({ ok: false, error: dripErr?.message || 'insert_failed' }, 500);

  // Steps optional via initial POST anlegen
  if (Array.isArray(body.steps) && body.steps.length > 0) {
    const rows = body.steps.map((s, idx) => ({
      drip_id: drip.id,
      template_id: s.template_id,
      delay_days: Math.max(0, Math.floor(s.delay_days ?? 0)),
      step_order: idx + 1,
    }));
    const invalid = rows.find(r => !r.template_id);
    if (invalid) {
      await sb.from('marketing_drips').delete().eq('id', drip.id);  // Rollback
      return json({ ok: false, error: 'each step needs template_id' }, 400);
    }
    const { error: stepsErr } = await sb.from('marketing_drip_steps').insert(rows);
    if (stepsErr) {
      await sb.from('marketing_drips').delete().eq('id', drip.id);  // Rollback (FK cascade löscht steps)
      return json({ ok: false, error: stepsErr.message }, 500);
    }
  }

  return json({ ok: true, id: drip.id });
};
