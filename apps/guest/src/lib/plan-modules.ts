// PLAN_MODULES — Single Source of Truth für Paket → Modul Mapping.
// Exakt aus retaha-pakete-referenz.md Abschnitt 3 + 4 abgeleitet.
// Bei Änderungen: Referenzdokument, diese Datei, Stripe-Produkte und
// Preisseite synchron halten.

export type PlanTier = 'lite' | 'pro' | 'premium' | 'enterprise';

export interface PlanModuleEntry {
  minTier: PlanTier;
  addonForTiers?: PlanTier[];
}

const TIER_RANK: Record<PlanTier, number> = {
  lite: 0,
  pro: 1,
  premium: 2,
  enterprise: 3,
};

// Systembasis: immer aktiv in jedem Paket (kein Verkaufsargument)
// Lite: breakfast, service, feedback, action_cards
// Pro: recommendations, multi_language, nfc_tags, pre_stay, stay_pushes
// Premium: eve (inkl.), wallet, marketing, loyalty, referrals, best_price, microsite
// Enterprise: multi_property, white_label, api_access, custom_email_domain
// Intern (kein Plan-Gate): showcase
export const PLAN_MODULES: Record<string, PlanModuleEntry> = {
  welcome:   { minTier: 'lite' },
  wifi:      { minTier: 'lite' },
  // Lite
  breakfast:     { minTier: 'lite' },
  service:       { minTier: 'lite' },
  feedback:      { minTier: 'lite' },
  action_cards:  { minTier: 'lite' },
  // Pro
  recommendations: { minTier: 'pro' },
  multi_language:  { minTier: 'pro' },
  nfc_tags:        { minTier: 'pro' },
  pre_stay:        { minTier: 'pro' },
  stay_pushes:     { minTier: 'pro' },
  // Premium (Eve inkl.; als Add-on für Lite + Pro buchbar)
  eve:        { minTier: 'premium', addonForTiers: ['lite', 'pro'] },
  wallet:     { minTier: 'premium' },
  marketing:  { minTier: 'premium' },
  loyalty:    { minTier: 'premium' },
  referrals:  { minTier: 'premium' },
  best_price: { minTier: 'premium' },
  microsite:  { minTier: 'premium' },
  // Enterprise
  multi_property:      { minTier: 'enterprise' },
  white_label:         { minTier: 'enterprise' },
  api_access:          { minTier: 'enterprise' },
  custom_email_domain: { minTier: 'enterprise' },
  // Intern — immer verfügbar (kein Tier-Gate)
  showcase: { minTier: 'lite' },
};

export function isModuleAvailable(
  hotel: { plan?: string | null; addons?: string[] | null },
  key: string,
): boolean {
  const entry = PLAN_MODULES[key];
  if (!entry) return false;

  const hotelPlan = (hotel.plan ?? 'lite') as PlanTier;
  const planRank = TIER_RANK[hotelPlan] ?? 0;
  const modRank  = TIER_RANK[entry.minTier];

  if (planRank >= modRank) return true;

  if (entry.addonForTiers?.includes(hotelPlan) && (hotel.addons ?? []).includes(key)) {
    return true;
  }

  return false;
}
