// @retaha/marketing
// Marketing-Lib: Drips, Bulk-Send, Translate-with-Vars
//
// ⚠️ Phase B.4 PENDING — Migration in nächstem Sprint-F-Turn.
//
// Quelle (kopieren in nächstem Turn):
//   src/lib/marketing/drips.ts                  → ./drips.ts
//   src/lib/marketing/send.ts                   → ./send.ts
//   src/lib/marketing/translate-with-vars.ts    → ./translate-with-vars.ts
//   src/lib/marketing/variables.ts              → ./variables.ts
//   src/lib/marketing/stay-push-variables.ts    → ./stay-push-variables.ts
//   src/lib/marketing/html-sanitize.ts          → ./html-sanitize.ts
//
// Import-Anpassungen: '../env' → '@retaha/db', '../wallet/X' → '@retaha/wallet'.
// Tests: marketing-variables (18/18), translate-preserve (19/19), drips (8/8),
// tracking (17/17) — alle behalten Pass-Status.

export const PACKAGE_NAME = '@retaha/marketing';
export const MIGRATION_STATUS = 'pending-phase-b-continuation' as const;
