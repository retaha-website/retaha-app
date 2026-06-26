// POST /api/loyalty/config — Hotelier speichert loyalty_config (Punkte/Nacht, Tiers, Rewards).
import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const s = (v: unknown, max: number): string => String(v ?? '').slice(0, max);
const num = (v: unknown, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const slug = (v: unknown, fallback: string): string =>
  (s(v, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || fallback);

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const points_per_night = num(body.points_per_night, 0, 10000);

  const tiers = (Array.isArray(body.tiers) ? body.tiers : []).slice(0, 10).map((t: any, i: number) => ({
    key: slug(t.key, `tier_${i}`),
    name: s(t.name, 60),
    threshold_points: num(t.threshold_points, 0, 1_000_000),
    benefits: (Array.isArray(t.benefits) ? t.benefits : []).slice(0, 12)
      .map((b: any) => ({ title: s(b.title, 120), desc: s(b.desc, 200) }))
      .filter((b: any) => b.title),
  })).filter((t: any) => t.name);

  const rewards = (Array.isArray(body.rewards) ? body.rewards : []).slice(0, 30).map((r: any, i: number) => ({
    id: slug(r.id, `reward_${i}`),
    title: s(r.title, 120),
    desc: s(r.desc, 200),
    cost_points: num(r.cost_points, 0, 1_000_000),
    active: r.active !== false,
  })).filter((r: any) => r.title);

  if (tiers.length === 0) return json({ ok: false, error: 'Mindestens eine Status-Stufe wird benötigt.' }, 400);

  const sb = createSupabaseServiceRoleInstance();
  const { error } = await sb.from('loyalty_config').upsert({
    hotel_id: hotel.id,
    points_per_night,
    tiers,
    rewards,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'hotel_id' });

  if (error) {
    console.error('[loyalty/config] upsert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
