// Sprint Wallet · Phase 7 — Push-Guard (Marketing vs Service)
//
// KRITISCHE DSGVO-REGEL:
//
//   Marketing-Push respektiert state='opted_out'  → wird NICHT gesendet
//   Service-Push   ignoriert  state='opted_out'   → wird trotzdem gesendet
//
// Begründung:
//   - Marketing-Push (Newsletter, Aktionen, Events) erfordert explizite
//     Werbe-Einwilligung (DSGVO Art. 6 Abs. 1 lit. a / Art. 7).
//     Opt-Out wirkt sofort und global für dieses Hotel.
//   - Service-Push (Frühstücks-Reminder, Service-Bestätigung, Late-Checkout)
//     erfolgt während eines aktiven Aufenthalts. Diese Verarbeitung ist
//     Vertragserfüllung (DSGVO Art. 6 Abs. 1 lit. b) und NICHT abhängig
//     von der Werbe-Einwilligung.
//
// Diese Datei ist die EINZIGE Stelle, an der diese Trennung kodifiziert ist.
// Marketing-Send-Code (Modul C) und Service-Send-Code (Modul D) MÜSSEN
// diese Helpers nutzen — niemals direkt auf state prüfen.

export type PushType = 'marketing' | 'service';

export interface PushEligibilityInput {
  /** wallet_passes.state */
  state: 'active' | 'opted_out' | 'expired';
  /** wallet_passes.marketing_consent_given */
  marketingConsentGiven: boolean;
  /** Art des Pushes — entscheidet ob Consent/Opt-Out greift */
  pushType: PushType;
}

export interface PushEligibilityResult {
  canSend: boolean;
  reason: string;
}

/**
 * Einzige Stelle die entscheidet, ob ein Wallet-Pass einen Push erhalten darf.
 *
 * @example
 *   const r = canSendPush({ state: pass.state, marketingConsentGiven: pass.consent, pushType: 'marketing' });
 *   if (!r.canSend) { skip(r.reason); return; }
 */
export function canSendPush(input: PushEligibilityInput): PushEligibilityResult {
  // Expired = Pass dauerhaft inaktiv (z.B. Hotel-Beziehung gekündigt). Beides aus.
  if (input.state === 'expired') {
    return { canSend: false, reason: 'pass_expired' };
  }

  if (input.pushType === 'service') {
    // Vertragserfüllung: opt_out wird ignoriert. expired bleibt blockiert.
    // Marketing-Consent ist irrelevant.
    return { canSend: true, reason: 'service_push_contract_fulfillment' };
  }

  // Marketing: alles muss stimmen
  if (input.state === 'opted_out') {
    return { canSend: false, reason: 'marketing_opted_out' };
  }
  if (!input.marketingConsentGiven) {
    return { canSend: false, reason: 'marketing_consent_missing' };
  }
  return { canSend: true, reason: 'marketing_consent_given' };
}

/**
 * Filter-Variante für Bulk-Sends. Returnt nur die Pässe die den Push
 * empfangen dürfen, plus eine Zähl-Statistik für Audit-Logs.
 */
export function filterEligiblePasses<T extends PushEligibilityInput>(
  passes: T[],
  pushType: PushType,
): { eligible: T[]; skipped: Array<{ pass: T; reason: string }> } {
  const eligible: T[] = [];
  const skipped: Array<{ pass: T; reason: string }> = [];
  for (const p of passes) {
    const r = canSendPush({ ...p, pushType });
    if (r.canSend) eligible.push(p);
    else skipped.push({ pass: p, reason: r.reason });
  }
  return { eligible, skipped };
}
