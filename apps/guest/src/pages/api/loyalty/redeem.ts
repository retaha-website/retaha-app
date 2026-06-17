// POST /api/loyalty/redeem — Gast löst eine Prämie ein.
// Auth: Stay-Session-Cookie. Echter Gast → redeemReward (DB, Service-Role).
// Demo-/Showcase-Session → simulierter Voucher (kein DB-Write, kein guests-Row).
import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { redeemReward, generateVoucherCode, DEFAULT_LOYALTY_CONFIG, type LoyaltyReward } from '@retaha/loyalty';
import { isDemoSession } from '../../../lib/showcase/session';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { reward_id?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const rewardId = String(body.reward_id ?? '');
  if (!rewardId) return json({ ok: false, error: 'missing_reward' }, 400);

  const sbSr = createSupabaseServiceRoleInstance();

  // ── Demo: simulierter Voucher, kein DB-Write ──────────────────────────────
  if (isDemoSession(session)) {
    const { data: cfg } = await sbSr.from('loyalty_config').select('rewards').eq('hotel_id', session.hotel_id).maybeSingle();
    const rewards = (cfg?.rewards ?? DEFAULT_LOYALTY_CONFIG.rewards) as LoyaltyReward[];
    const reward = rewards.find(r => r.id === rewardId && r.active !== false);
    if (!reward) return json({ ok: false, error: 'reward_unavailable' }, 400);
    return json({
      ok: true, demo: true,
      voucher_code: generateVoucherCode(),
      reward_title: reward.title,
      cost_points: reward.cost_points,
      expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    });
  }

  // ── Echter Gast ───────────────────────────────────────────────────────────
  const { data: stay } = await sbSr.from('stays')
    .select('hotel_id, guest_id').eq('id', session.stay_id).maybeSingle();
  if (!stay?.guest_id) return json({ ok: false, error: 'no_guest' }, 400);

  const result = await redeemReward(sbSr, {
    hotelId: (stay as any).hotel_id,
    guestId: (stay as any).guest_id,
    rewardId,
  });
  return json(result, result.ok ? 200 : 400);
};
