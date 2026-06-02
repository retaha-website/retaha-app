// @retaha/eve
// Eve-KI-Concierge: Hybrid Router (Haiku/Sonnet), Tools, Context-Loader
//
// ⚠️ Phase B.4 PENDING — Migration in nächstem Sprint-F-Turn.
//
// Quelle (kopieren in nächstem Turn):
//   src/lib/eve/anthropic-client.ts   → ./anthropic-client.ts
//   src/lib/eve/router.ts             → ./router.ts (Hybrid Haiku/Sonnet)
//   src/lib/eve/system-prompt.ts      → ./system-prompt.ts
//   src/lib/eve/tools.ts              → ./tools.ts
//   src/lib/eve/tool-executors.ts     → ./tool-executors.ts
//   src/lib/eve/suggestions.ts        → ./suggestions.ts
//   src/lib/eve/translator.ts         → ./translator.ts
//
// Import-Anpassungen: '../env' → '@retaha/db', './X' bleibt './X' lokal.

export const PACKAGE_NAME = '@retaha/eve';
export const MIGRATION_STATUS = 'pending-phase-b-continuation' as const;
