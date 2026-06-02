// @retaha/i18n
// i18n-Setup: Locale-Detection, Auto-Translation via Haiku, 10 Sprachen
//
// ⚠️ Phase B.4 PENDING — Migration in nächstem Sprint-F-Turn.
//
// Quelle (kopieren in nächstem Turn):
//   src/lib/i18n.ts                  → ./core.ts (Hauptmodul)
//   src/lib/i18n.extra-langs.ts      → ./extra-langs.ts
//   src/lib/i18n/index.ts            → ./helpers.ts
//   src/lib/i18n/picker.ts           → ./picker.ts
//   src/lib/i18n/save-hook.ts        → ./save-hook.ts
//   src/lib/i18n/translator.ts       → ./translator.ts
//   src/lib/i18n/types.ts            → ./types.ts
//
// Import-Anpassungen: '../env' → '@retaha/db'.
// Translator nutzt Anthropic-Haiku via @anthropic-ai/sdk.

export const PACKAGE_NAME = '@retaha/i18n';
export const MIGRATION_STATUS = 'pending-phase-b-continuation' as const;
