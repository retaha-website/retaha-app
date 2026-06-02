// Sprint Wallet · Phase 1 — Google Wallet Konfiguration
//
// ENV-Bündelung + Konfig-Loader. Pattern identisch zu src/lib/push/config.ts.
// Wenn Issuer-Account/Service-Account fehlen: isWalletConfigured() == false,
// alle Lib-Funktionen liefern sauberen no-op (kein Crash, kein Mock-Output).
//
// ENV (.env, gitignored):
//   GOOGLE_WALLET_ISSUER_ID                  – Numerische Issuer-ID von Google
//   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL      – ...@*.iam.gserviceaccount.com
//   GOOGLE_WALLET_SERVICE_ACCOUNT_KEY        – Base64-encoded JSON Service-Account-Key
//
// Pre-Sprint-Tasks (Taha):
//   1) sentry-äquivalent: Google Cloud Project anlegen, Wallet API aktivieren
//   2) Issuer-Account beantragen (5-10 Werktage Wartezeit)
//   3) Service-Account erstellen, JSON-Key herunterladen, base64-encoden:
//        base64 -w0 service-account.json
//      → in .env als GOOGLE_WALLET_SERVICE_ACCOUNT_KEY=<base64>

import { getEnv } from '@retaha/db';

export interface WalletServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export interface WalletConfig {
  issuerId: string;
  serviceAccount: WalletServiceAccount;
}

let cachedConfig: WalletConfig | null | 'missing' = null;

/**
 * Lädt die Wallet-Config aus ENV. Returns null wenn nicht konfiguriert.
 * Cached nach erstem Read.
 */
export function getWalletConfig(): WalletConfig | null {
  if (cachedConfig === 'missing') return null;
  if (cachedConfig) return cachedConfig;

  const issuerId = getEnv('GOOGLE_WALLET_ISSUER_ID');
  const saEmail = getEnv('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL');
  const saKeyB64 = getEnv('GOOGLE_WALLET_SERVICE_ACCOUNT_KEY');

  if (!issuerId || !saEmail || !saKeyB64) {
    cachedConfig = 'missing';
    return null;
  }

  let serviceAccount: WalletServiceAccount;
  try {
    const decoded = Buffer.from(saKeyB64, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (!parsed.client_email || !parsed.private_key) {
      console.warn('[wallet/config] Service-Account-JSON fehlt client_email oder private_key');
      cachedConfig = 'missing';
      return null;
    }
    serviceAccount = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      project_id: parsed.project_id,
    };
  } catch (err) {
    console.warn('[wallet/config] Service-Account-Key konnte nicht decoded werden:', (err as Error).message);
    cachedConfig = 'missing';
    return null;
  }

  // Sanity-Check: ENV-Email muss zum Key passen
  if (serviceAccount.client_email !== saEmail) {
    console.warn(
      '[wallet/config] GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL != Key.client_email',
      `(env=${saEmail}, key=${serviceAccount.client_email})`,
    );
  }

  cachedConfig = { issuerId, serviceAccount };
  return cachedConfig;
}

export function isWalletConfigured(): boolean {
  return getWalletConfig() !== null;
}

/**
 * Helper: pro-Hotel Pass-Class-ID. Format: ISSUER_ID.hotel_<uuid>
 * Google verlangt Punkt als Separator; UUIDs sind URL-safe.
 */
export function buildPassClassId(issuerId: string, hotelId: string): string {
  return `${issuerId}.hotel_${hotelId.replace(/-/g, '')}`;
}

/**
 * Helper: pro-Pass Object-ID. Format: ISSUER_ID.pass_<uuid>
 */
export function buildPassObjectId(issuerId: string, walletPassUuid: string): string {
  return `${issuerId}.pass_${walletPassUuid.replace(/-/g, '')}`;
}
