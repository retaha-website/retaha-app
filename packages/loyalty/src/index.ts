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
