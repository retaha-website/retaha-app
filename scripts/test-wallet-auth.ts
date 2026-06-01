// Sprint Wallet Phase 4 — Smoke-Test für Google-Wallet-Auth
//
// Usage: npm run test:wallet-auth
//
// Liest .env, ruft pingWalletAuth() auf. Wenn das grün ist, kann Phase 4
// (Pass-Class-Submission) starten.

import { pingWalletAuth } from '../src/lib/wallet/google';
import { getWalletConfig } from '../src/lib/wallet/config';

async function main() {
  console.log('[wallet-auth] starting smoke-test ...');

  const cfg = getWalletConfig();
  if (!cfg) {
    console.error('[wallet-auth] ✗ Wallet-Config fehlt — prüfe .env:');
    console.error('  GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,');
    console.error('  GOOGLE_WALLET_SERVICE_ACCOUNT_KEY (base64)');
    process.exit(1);
  }
  console.log(`[wallet-auth] config: issuer=${cfg.issuerId}, sa=${cfg.serviceAccount.client_email}`);

  const result = await pingWalletAuth();
  if (result.ok) {
    console.log(`[wallet-auth] ✓ Auth OK (${result.reason}) — Service-Account kann Access-Tokens holen`);
    process.exit(0);
  }
  console.error(`[wallet-auth] ✗ Auth failed: ${result.reason}`);
  process.exit(1);
}

main().catch(err => {
  console.error('[wallet-auth] ✗ uncaught:', err);
  process.exit(1);
});
