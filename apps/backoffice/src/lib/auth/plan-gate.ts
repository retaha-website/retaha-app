// Plan-Gating — serverseitige Durchsetzung der Modul-Berechtigungen.
//
// Quelle der Wahrheit: Produkt-Matrix §12 (retaha-journey-maps). Das Ausblenden im
// Drawer (KeyMenuDropdown) ist nur Kosmetik — die Sperre HIER (in der Middleware)
// verhindert den direkten URL-/API-Zugriff (z. B. „/marketing" eintippen trotz Lite).
//
// hotels.plan ist die einzige Entitlement-Wahrheit und spiegelt auch den aktiven
// Trial wider (pa/set-plan setzt plan direkt; cron/trial-expiry stuft auf 'lite'
// zurück). Daher reicht der reine Plan-Rang — kein Trial-Sonderfall nötig, und der
// Guard bleibt deckungsgleich mit dem Drawer (der ebenfalls nur den Rang nutzt).

export const PLAN_RANK: Record<string, number> = { lite: 0, pro: 1, premium: 2, enterprise: 3 };

export type RequiredPlan = 'pro' | 'premium';

export function hasPlanAccess(plan: string | null | undefined, required: RequiredPlan): boolean {
  return (PLAN_RANK[plan ?? 'lite'] ?? 0) >= (PLAN_RANK[required] ?? 99);
}

export interface RouteGate {
  /** Modul-Key für /unlock/[modul] (Upgrade-Vorschau). */
  module: string;
  /** Mindest-Plan laut Produkt-Matrix §12. */
  required: RequiredPlan;
  /** Pfad-Prefixe — Seite UND zugehörige API (z. B. /marketing + /api/marketing). */
  prefixes: string[];
}

// Reihenfolge egal — die Prefixe sind disjunkt. Die öffentlichen Marketing-APIs
// (/api/marketing/consent, /api/marketing/track) stehen in der Middleware-Whitelist
// (isPublic) und erreichen diesen Gate nie. /checkout (Self-Checkout) sperrt sich
// bereits in-page über isPremium und ist daher hier bewusst nicht gelistet.
export const ROUTE_GATES: RouteGate[] = [
  { module: 'marketing',        required: 'premium', prefixes: ['/marketing', '/api/marketing'] },
  { module: 'email-domain',     required: 'premium', prefixes: ['/email-domain'] },
  { module: 'wallet',           required: 'premium', prefixes: ['/wallet-keys'] },
  { module: 'stay-push',        required: 'premium', prefixes: ['/stay-pushes', '/api/stay-push', '/api/stay-pushes'] },
  { module: 'loyalty',          required: 'premium', prefixes: ['/loyalty', '/api/loyalty'] },
  { module: 'booking-engine',   required: 'premium', prefixes: ['/booking-engine'] },
  { module: 'best-price',       required: 'premium', prefixes: ['/best-price'] },
  { module: 'booking-recovery', required: 'premium', prefixes: ['/booking-recovery'] },
  { module: 'empfehlungen',     required: 'pro',     prefixes: ['/places'] },
  { module: 'nfc-tags',         required: 'pro',     prefixes: ['/nfc-tags'] },
  { module: 'pms',              required: 'pro',     prefixes: ['/pms'] }, // Pro = externe Integration (Matrix §12)
];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

export function findRouteGate(path: string): RouteGate | undefined {
  return ROUTE_GATES.find(g => g.prefixes.some(p => matchesPrefix(path, p)));
}
