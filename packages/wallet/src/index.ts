// @retaha/wallet
// Wallet-Pass-Lib: push-guard, Google-Wallet, Apple-Wallet
//
// ⚠️ Phase B.4 PENDING — Migration in nächstem Sprint-F-Turn.
//
// Quelle (kopieren in nächstem Turn):
//   src/lib/wallet/push-guard.ts       → ./push-guard.ts
//   src/lib/wallet/google.ts            → ./google.ts
//   src/lib/wallet/deep-link-token.ts   → ./deep-link-token.ts
//   src/lib/wallet/opt-out-token.ts     → ./opt-out-token.ts
//   src/lib/wallet/returning-guest.ts   → ./returning-guest.ts
//   src/lib/wallet/stay-push.ts         → ./stay-push.ts
//   src/lib/wallet/config.ts            → ./config.ts
//
// Import-Anpassungen: '../env' → '@retaha/db'.
// Tests aus scripts/test-wallet-push-guard.ts: 8/8 Pass.

export const PACKAGE_NAME = '@retaha/wallet';
export const MIGRATION_STATUS = 'pending-phase-b-continuation' as const;
