import Stripe from 'stripe';

export type StripePlanKey = 'lite' | 'pro' | 'premium';
export type BillingInterval = 'monthly' | 'yearly';

// Lazy singleton — only instantiated when checkout/webhook code runs, not on every import.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = import.meta.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[stripe] STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

// ── Price ID → plan/addon (for webhook reverse lookup) ────────────────────────
// Built once at module init. Entries with unset env vars are omitted so the
// map never contains `undefined` as a key.

export type PriceEntry =
  | { plan: StripePlanKey; interval: BillingInterval }
  | { addon: 'eve' };

function buildPriceMap(): Record<string, PriceEntry> {
  const pairs: Array<[string | undefined, PriceEntry]> = [
    [import.meta.env.STRIPE_PRICE_LITE_MONTHLY,     { plan: 'lite',    interval: 'monthly' }],
    [import.meta.env.STRIPE_PRICE_LITE_YEARLY,      { plan: 'lite',    interval: 'yearly'  }],
    [import.meta.env.STRIPE_PRICE_PRO_MONTHLY,      { plan: 'pro',     interval: 'monthly' }],
    [import.meta.env.STRIPE_PRICE_PRO_YEARLY,       { plan: 'pro',     interval: 'yearly'  }],
    [import.meta.env.STRIPE_PRICE_PREMIUM_MONTHLY,  { plan: 'premium', interval: 'monthly' }],
    [import.meta.env.STRIPE_PRICE_PREMIUM_YEARLY,   { plan: 'premium', interval: 'yearly'  }],
    [import.meta.env.STRIPE_PRICE_EVE_ADDON_MONTHLY, { addon: 'eve' }],
  ];
  return Object.fromEntries(pairs.filter((p): p is [string, PriceEntry] => !!p[0]));
}

export const PRICE_TO_PLAN: Record<string, PriceEntry> = buildPriceMap();

// ── plan + interval → Price ID (for checkout session creation) ────────────────

export function getPriceId(plan: StripePlanKey, interval: BillingInterval): string {
  const ids: Record<StripePlanKey, Record<BillingInterval, string | undefined>> = {
    lite:    { monthly: import.meta.env.STRIPE_PRICE_LITE_MONTHLY,    yearly: import.meta.env.STRIPE_PRICE_LITE_YEARLY    },
    pro:     { monthly: import.meta.env.STRIPE_PRICE_PRO_MONTHLY,     yearly: import.meta.env.STRIPE_PRICE_PRO_YEARLY     },
    premium: { monthly: import.meta.env.STRIPE_PRICE_PREMIUM_MONTHLY, yearly: import.meta.env.STRIPE_PRICE_PREMIUM_YEARLY },
  };
  const id = ids[plan][interval];
  if (!id) throw new Error(`[stripe] STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()} is not set`);
  return id;
}

export function getEveAddonPriceId(): string {
  const id = import.meta.env.STRIPE_PRICE_EVE_ADDON_MONTHLY;
  if (!id) throw new Error('[stripe] STRIPE_PRICE_EVE_ADDON_MONTHLY is not set');
  return id;
}

// ── Type guard helpers ─────────────────────────────────────────────────────────

export function isPlanEntry(e: PriceEntry): e is { plan: StripePlanKey; interval: BillingInterval } {
  return 'plan' in e;
}

export function isAddonEntry(e: PriceEntry): e is { addon: 'eve' } {
  return 'addon' in e;
}
