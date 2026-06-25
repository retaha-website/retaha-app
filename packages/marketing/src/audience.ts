// @retaha/marketing · audience.ts
//
// EINE Wahrheit für „Wer ist Opt-in / sendefähig?". Wird vom echten Versand
// (send.ts) UND der Backoffice-Kontaktliste (/marketing/guests) genutzt, damit
// die UI exakt dieselbe Empfängermenge zeigt, die tatsächlich gesendet wird.
//
// Kanäle getrennt:
//   - E-Mail (marketing_waitlist): Double-Opt-in bestätigt UND nicht abgemeldet.
//   - Wallet (wallet_passes): delegiert an canSendPush() aus @retaha/wallet — das
//     bereits kanonische DSGVO-Gate (state === 'active' && marketing_consent_given).

import { canSendPush } from '@retaha/wallet';

export interface EmailOptInRow {
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

export interface WalletOptInRow {
  state: string | null;
  marketing_consent_given: boolean | null;
}

/** E-Mail-Opt-in: DOI bestätigt und nicht abgemeldet. */
export function isEmailOptIn(row: EmailOptInRow): boolean {
  return !!row.confirmed_at && !row.unsubscribed_at;
}

/**
 * Wallet-Push-Opt-in: delegiert an die kanonische Versand-Wahrheit canSendPush()
 * (state active + marketing_consent_given). KEINE Google-Sync-Prüfung — das ist
 * Zustellbarkeit, nicht Einwilligung.
 */
export function isWalletOptIn(pass: WalletOptInRow): boolean {
  return canSendPush({
    state: (pass.state ?? 'expired') as 'active' | 'opted_out' | 'expired',
    marketingConsentGiven: !!pass.marketing_consent_given,
    pushType: 'marketing',
  }).canSend;
}

/**
 * Supabase-Filter für E-Mail-Opt-ins auf marketing_waitlist — exakt dieselbe
 * Definition wie isEmailOptIn(), als Query-Filter. send.ts und die Kontaktliste
 * teilen sich diesen einen Filter, damit beide identische Empfänger sehen.
 */
export function applyEmailOptInFilter(query: any): any {
  return query.not('confirmed_at', 'is', null).is('unsubscribed_at', null);
}
