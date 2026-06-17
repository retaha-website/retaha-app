// @retaha/loyalty — nächtebasiertes Status-/Punkte-System (shared logic).
//
// Reine, serverseitig genutzte Logik: Tier-Berechnung, Punkte-Helfer, Voucher,
// idempotentes Earning. DB-Zugriff erfolgt ausschließlich über einen
// übergebenen Supabase-Service-Role-Client — die Lib instanziiert selbst keinen.

// ── Typen ──────────────────────────────────────────────────────────────────

export interface LoyaltyBenefit { title: string; desc: string; }

export interface LoyaltyTier {
  key: string;
  name: string;
  threshold_points: number;
  benefits: LoyaltyBenefit[];
}

export interface LoyaltyReward {
  id: string;
  title: string;
  desc: string;
  cost_points: number;
  active: boolean;
}

export interface LoyaltyConfig {
  points_per_night: number;
  tiers: LoyaltyTier[];
  rewards: LoyaltyReward[];
}

// Muss mit dem Migration-Seed (20260617120000_loyalty_program.sql) übereinstimmen
// — Fallback, falls (noch) keine loyalty_config-Row existiert.
export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  points_per_night: 10,
  tiers: [
    { key: 'bronze', name: 'Bronze', threshold_points: 0, benefits: [
      { title: 'Willkommensgetränk', desc: 'Bei jeder Ankunft' },
      { title: 'Späteres Check-out auf Anfrage', desc: 'Nach Verfügbarkeit' },
    ] },
    { key: 'silver', name: 'Silber', threshold_points: 100, benefits: [
      { title: 'Frühes Check-in ab 12:00', desc: '' },
      { title: 'Spätes Check-out bis 13:00', desc: '' },
      { title: 'Willkommensgetränk', desc: '' },
    ] },
    { key: 'gold', name: 'Gold', threshold_points: 250, benefits: [
      { title: 'Frühes Check-in ab 10:00', desc: '' },
      { title: 'Spätes Check-out bis 15:00', desc: '' },
      { title: 'Zimmer-Upgrade nach Verfügbarkeit', desc: '' },
      { title: 'Willkommenspaket', desc: '' },
    ] },
  ],
  rewards: [
    { id: 'welcome_drink', title: 'Willkommensgetränk', desc: 'Ein Getränk deiner Wahl an der Bar', cost_points: 50, active: true },
    { id: 'late_checkout', title: 'Spätes Check-out (14:00)', desc: 'Verlängere deinen letzten Tag', cost_points: 100, active: true },
    { id: 'room_upgrade', title: 'Zimmer-Upgrade', desc: 'Nach Verfügbarkeit beim Check-in', cost_points: 250, active: true },
  ],
};

// ── Reine Berechnungs-Helfer ────────────────────────────────────────────────

/** Nächte zwischen zwei Daten (Datums-Differenz in UTC, min. 1). */
export function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  const ciDay = Date.UTC(ci.getUTCFullYear(), ci.getUTCMonth(), ci.getUTCDate());
  const coDay = Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate());
  const nights = Math.round((coDay - ciDay) / 86_400_000);
  return Math.max(1, nights);
}

export function pointsForNights(nights: number, pointsPerNight: number): number {
  return Math.max(0, Math.round(nights)) * Math.max(0, pointsPerNight);
}

/** Höchstes Tier, dessen Schwelle <= lifetimePoints. */
export function computeTier(lifetimePoints: number, tiers: LoyaltyTier[]): LoyaltyTier {
  const sorted = [...tiers].sort((a, b) => a.threshold_points - b.threshold_points);
  let current = sorted[0] ?? DEFAULT_LOYALTY_CONFIG.tiers[0];
  for (const t of sorted) {
    if (lifetimePoints >= t.threshold_points) current = t;
    else break;
  }
  return current;
}

export interface TierProgress {
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number; // 0 wenn höchstes Tier
  progressPct: number;  // 0–100 Richtung nächstes Tier
}

export function computeTierProgress(lifetimePoints: number, tiers: LoyaltyTier[]): TierProgress {
  const sorted = [...tiers].sort((a, b) => a.threshold_points - b.threshold_points);
  const tier = computeTier(lifetimePoints, sorted);
  const idx = sorted.findIndex(t => t.key === tier.key);
  const nextTier = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  if (!nextTier) return { tier, nextTier: null, pointsToNext: 0, progressPct: 100 };
  const span = nextTier.threshold_points - tier.threshold_points;
  const into = lifetimePoints - tier.threshold_points;
  const pct = span > 0 ? Math.min(100, Math.max(0, Math.round((into / span) * 100))) : 100;
  return { tier, nextTier, pointsToNext: Math.max(0, nextTier.threshold_points - lifetimePoints), progressPct: pct };
}

/** Voucher-Code: gut lesbar, kollisionsarm (ohne I/O/0/1). z.B. "A7K2-9QXM". */
export function generateVoucherCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += A[Math.floor(Math.random() * A.length)];
    if (i === 3) code += '-';
  }
  return code;
}

// ── Earning (DB via übergebenem Service-Role-Client) ────────────────────────

export interface AwardResult {
  ok: boolean;
  awarded?: number;
  nights?: number;
  tier?: string;
  skipped?: string;
  error?: string;
}

/**
 * Schreibt Punkte für einen abgeschlossenen Stay gut.
 * - Gated auf hotel_settings.features.loyalty === true.
 * - Idempotent je stay_id (unique partial index uniq_loyalty_tx_earn_per_stay):
 *   ein erneuter Aufruf für denselben Stay vergibt KEINE Doppel-Punkte.
 * - Saldo wird aus dem Ledger neu berechnet (Quelle der Wahrheit):
 *   balance = Summe aller Punkte; lifetime = Summe der positiven Punkte (sinkt nie).
 * Best-effort: gibt Status zurück, wirft nicht (Aufrufer wrapt zusätzlich in try/catch).
 */
export async function awardStayPoints(sb: any, args: {
  hotelId: string;
  guestId: string;
  stayId: string;
  checkIn: string | Date;
  checkOut: string | Date;
}): Promise<AwardResult> {
  const { hotelId, guestId, stayId } = args;
  if (!hotelId || !guestId || !stayId) return { ok: true, skipped: 'missing_ids' };

  // Feature-Gate
  const { data: hs } = await sb.from('hotel_settings').select('features').eq('hotel_id', hotelId).maybeSingle();
  if (((hs?.features ?? {}) as Record<string, unknown>).loyalty !== true) {
    return { ok: true, skipped: 'loyalty_disabled' };
  }

  // Config (Punkte/Nacht + Tiers); Fallback Defaults
  const { data: cfg } = await sb.from('loyalty_config')
    .select('points_per_night, tiers').eq('hotel_id', hotelId).maybeSingle();
  const pointsPerNight = (cfg?.points_per_night ?? DEFAULT_LOYALTY_CONFIG.points_per_night) as number;
  const tiers = (cfg?.tiers ?? DEFAULT_LOYALTY_CONFIG.tiers) as LoyaltyTier[];

  const nights = nightsBetween(args.checkIn, args.checkOut);
  const points = pointsForNights(nights, pointsPerNight);
  if (points <= 0) return { ok: true, awarded: 0, skipped: 'no_points' };

  // Idempotent: earn-Ledger-Eintrag (unique je stay_id WHERE type='earn')
  const { error: txErr } = await sb.from('loyalty_transactions').insert({
    hotel_id: hotelId, guest_id: guestId, stay_id: stayId,
    type: 'earn', points, nights, note: 'Stay-Checkout',
  });
  if (txErr) {
    if ((txErr.code ?? '') === '23505') return { ok: true, awarded: 0, skipped: 'already_awarded' };
    return { ok: false, error: txErr.message };
  }

  // Saldo aus dem Ledger neu berechnen
  const { data: txs } = await sb.from('loyalty_transactions')
    .select('points').eq('hotel_id', hotelId).eq('guest_id', guestId);
  const rows = (txs ?? []) as Array<{ points: number }>;
  const balance = rows.reduce((s, r) => s + (r.points ?? 0), 0);
  const lifetime = rows.reduce((s, r) => s + (r.points > 0 ? r.points : 0), 0);
  const tier = computeTier(lifetime, tiers).key;

  const { error: upErr } = await sb.from('loyalty_points').upsert({
    hotel_id: hotelId, guest_id: guestId,
    points_balance: balance, points_lifetime: lifetime, tier,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'hotel_id,guest_id' });
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, awarded: points, nights, tier };
}

// ── Redemption (DB via übergebenem Service-Role-Client) ─────────────────────

export interface RedeemResult {
  ok: boolean;
  error?: string;       // 'loyalty_disabled' | 'reward_unavailable' | 'insufficient_points' | ...
  voucher_code?: string;
  reward_title?: string;
  cost_points?: number;
  expires_at?: string;
  balance?: number;     // Saldo NACH der Einlösung
}

/**
 * Löst eine Prämie für einen Gast ein.
 * - Gated auf hotel_settings.features.loyalty === true.
 * - Reward muss in loyalty_config.rewards existieren und active sein.
 * - Saldo wird aus dem Ledger gelesen; reicht er nicht → insufficient_points.
 * - Schreibt loyalty_redemptions (Voucher, status 'issued', Ablauf) + Ledger-
 *   'redeem' (negativ, mit redemption_id) und rechnet den Saldo neu.
 * - Voucher-Code kollisionsfrei (unique hotel_id,voucher_code → Retry bei 23505).
 * Hinweis: kein DB-Transaktions-Wrapper — bei Ledger-Fehler wird die eben
 * angelegte Redemption wieder entfernt (kein Voucher ohne Abbuchung).
 */
export async function redeemReward(sb: any, args: {
  hotelId: string;
  guestId: string;
  rewardId: string;
  expiresInDays?: number;
}): Promise<RedeemResult> {
  const { hotelId, guestId, rewardId } = args;
  if (!hotelId || !guestId || !rewardId) return { ok: false, error: 'missing_ids' };

  // Feature-Gate
  const { data: hs } = await sb.from('hotel_settings').select('features').eq('hotel_id', hotelId).maybeSingle();
  if (((hs?.features ?? {}) as Record<string, unknown>).loyalty !== true) {
    return { ok: false, error: 'loyalty_disabled' };
  }

  // Config (Rewards + Tiers); Fallback Defaults
  const { data: cfg } = await sb.from('loyalty_config')
    .select('rewards, tiers').eq('hotel_id', hotelId).maybeSingle();
  const rewards = (cfg?.rewards ?? DEFAULT_LOYALTY_CONFIG.rewards) as LoyaltyReward[];
  const tiers = (cfg?.tiers ?? DEFAULT_LOYALTY_CONFIG.tiers) as LoyaltyTier[];
  const reward = rewards.find(r => r.id === rewardId && r.active !== false);
  if (!reward) return { ok: false, error: 'reward_unavailable' };
  const cost = Math.max(0, Math.round(reward.cost_points || 0));

  // Saldo aus dem Ledger
  const { data: txs } = await sb.from('loyalty_transactions')
    .select('points').eq('hotel_id', hotelId).eq('guest_id', guestId);
  const rows = (txs ?? []) as Array<{ points: number }>;
  const balance = rows.reduce((s, r) => s + (r.points ?? 0), 0);
  if (balance < cost) return { ok: false, error: 'insufficient_points', balance };

  const expiresAt = new Date(Date.now() + (args.expiresInDays ?? 90) * 86_400_000).toISOString();

  // Redemption anlegen (Voucher-Kollision → neu würfeln)
  let redemptionId: string | null = null;
  let voucherCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    voucherCode = generateVoucherCode();
    const { data: red, error: redErr } = await sb.from('loyalty_redemptions').insert({
      hotel_id: hotelId, guest_id: guestId, reward_id: reward.id, reward_title: reward.title,
      cost_points: cost, voucher_code: voucherCode, status: 'issued', expires_at: expiresAt,
    }).select('id').single();
    if (!redErr && red) { redemptionId = red.id; break; }
    if ((redErr?.code ?? '') !== '23505') return { ok: false, error: redErr?.message || 'redemption_failed' };
  }
  if (!redemptionId) return { ok: false, error: 'voucher_collision' };

  // Ledger-Eintrag 'redeem' (negativ)
  const { error: txErr } = await sb.from('loyalty_transactions').insert({
    hotel_id: hotelId, guest_id: guestId, type: 'redeem', points: -cost,
    reward_id: reward.id, redemption_id: redemptionId, note: reward.title,
  });
  if (txErr) {
    await sb.from('loyalty_redemptions').delete().eq('id', redemptionId); // kein Voucher ohne Abbuchung
    return { ok: false, error: txErr.message };
  }

  // Saldo/Tier neu berechnen
  const { data: txs2 } = await sb.from('loyalty_transactions')
    .select('points').eq('hotel_id', hotelId).eq('guest_id', guestId);
  const rows2 = (txs2 ?? []) as Array<{ points: number }>;
  const newBalance = rows2.reduce((s, r) => s + (r.points ?? 0), 0);
  const lifetime = rows2.reduce((s, r) => s + (r.points > 0 ? r.points : 0), 0);
  await sb.from('loyalty_points').upsert({
    hotel_id: hotelId, guest_id: guestId,
    points_balance: newBalance, points_lifetime: lifetime, tier: computeTier(lifetime, tiers).key,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'hotel_id,guest_id' });

  return { ok: true, voucher_code: voucherCode, reward_title: reward.title, cost_points: cost, expires_at: expiresAt, balance: newBalance };
}

export interface VoucherView {
  voucher_code: string;
  reward_title: string;
  cost_points: number;
  status: 'issued' | 'validated' | 'expired' | 'cancelled';
  expires_at: string | null;
  validated_at: string | null;
  created_at: string;
  is_expired: boolean;
}

/** Hotelier-Lookup eines Vouchers (scoped auf hotel_id). */
export async function lookupVoucher(sb: any, hotelId: string, code: string): Promise<VoucherView | null> {
  const clean = String(code || '').trim().toUpperCase();
  if (!hotelId || !clean) return null;
  const { data } = await sb.from('loyalty_redemptions')
    .select('voucher_code, reward_title, cost_points, status, expires_at, validated_at, created_at')
    .eq('hotel_id', hotelId).eq('voucher_code', clean).maybeSingle();
  if (!data) return null;
  const isExpired = !!data.expires_at && new Date(data.expires_at).getTime() < Date.now();
  return { ...data, is_expired: isExpired } as VoucherView;
}

export interface ValidateResult {
  ok: boolean;
  error?: string;       // 'not_found' | 'already_validated' | 'cancelled' | 'expired'
  status?: string;
  reward_title?: string;
  validated_at?: string;
}

/** Voucher einlösen am Empfang: status 'issued' → 'validated' (einmalig). */
export async function validateVoucher(sb: any, args: {
  hotelId: string;
  code: string;
  validatedBy?: string | null;
}): Promise<ValidateResult> {
  const clean = String(args.code || '').trim().toUpperCase();
  if (!args.hotelId || !clean) return { ok: false, error: 'not_found' };

  const { data: row } = await sb.from('loyalty_redemptions')
    .select('id, status, reward_title, expires_at')
    .eq('hotel_id', args.hotelId).eq('voucher_code', clean).maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  if (row.status === 'validated') return { ok: false, error: 'already_validated', reward_title: row.reward_title, validated_at: row.validated_at };
  if (row.status === 'cancelled') return { ok: false, error: 'cancelled', reward_title: row.reward_title };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await sb.from('loyalty_redemptions').update({ status: 'expired' }).eq('id', row.id).eq('status', 'issued');
    return { ok: false, error: 'expired', reward_title: row.reward_title };
  }

  const validatedAt = new Date().toISOString();
  const { data: upd, error } = await sb.from('loyalty_redemptions')
    .update({ status: 'validated', validated_at: validatedAt, validated_by: args.validatedBy ?? null })
    .eq('id', row.id).eq('status', 'issued')   // nur wenn noch issued (Race-Schutz)
    .select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!upd) return { ok: false, error: 'already_validated', reward_title: row.reward_title };

  return { ok: true, status: 'validated', reward_title: row.reward_title, validated_at: validatedAt };
}
