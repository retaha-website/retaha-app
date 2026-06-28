import type { APIRoute } from 'astro';
import { getUser, isPlatformAdmin, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_PLANS = new Set(['lite', 'pro', 'premium', 'enterprise']);
const VALID_ADDONS = new Set(['eve']);

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ error: 'Nicht eingeloggt' }, 401);

  const isAdmin = await isPlatformAdmin(cookies, request);
  if (!isAdmin) return json({ error: 'Nicht autorisiert' }, 403);

  let body: { hotel_id?: unknown; plan?: unknown; addons?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Ungültiges JSON' }, 400); }

  const hotelId = body.hotel_id ? String(body.hotel_id) : null;
  const plan    = body.plan    ? String(body.plan)    : null;
  const reason  = body.reason  ? String(body.reason)  : null;
  const rawAddons = Array.isArray(body.addons) ? (body.addons as unknown[]) : [];
  const addons  = rawAddons.map(String).filter(a => VALID_ADDONS.has(a));

  if (!hotelId) return json({ error: 'hotel_id fehlt' }, 400);
  if (!plan || !VALID_PLANS.has(plan)) return json({ error: 'Ungültiger Plan' }, 400);

  const db = createSupabaseServiceRoleInstance();

  // Alten Plan lesen für Audit-Log
  const { data: hotel } = await db
    .from('hotels')
    .select('plan, addons')
    .eq('id', hotelId)
    .single();

  if (!hotel) return json({ error: 'Hotel nicht gefunden' }, 404);

  // Plan + Addons setzen
  const { error: updateErr } = await db
    .from('hotels')
    .update({ plan, addons, subscription_status: 'manual' })
    .eq('id', hotelId);

  if (updateErr) {
    console.error('[pa/set-plan] update error', updateErr);
    return json({ error: updateErr.message }, 500);
  }

  // Audit-Log
  await db.from('plan_change_log').insert({
    hotel_id: hotelId,
    changed_by: user.id,
    old_plan: hotel.plan ?? 'lite',
    new_plan: plan,
    old_addons: hotel.addons ?? [],
    new_addons: addons,
    reason,
  });

  return json({ ok: true });
};
