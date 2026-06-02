// @retaha/ui
// Shared Astro-Components, Theme-System, Bauhaus-DNA
//
// Phase B Sprint F: Styles + Theme-Lib + 4 Bauhaus-Components kopiert.
// Phase D-F: weitere Components werden hier hinzugefügt wenn Apps migrieren.
//
// Astro-Components werden NICHT als TS-Funktionen exportiert.
// Apps importieren direkt:
//   import ComingSoonModal from '@retaha/ui/components/admin/ComingSoonModal.astro';
//   import '@retaha/ui/styles/themes.css';

// Theme-Resolver (TS-Lib)
export {
  resolveTheme,
  isThemeId,
  THEME_DESCRIPTORS,
  type ThemeId,
  type ThemeDescriptor,
} from './theme';

// Marker-Konstanten für Re-Use
export const THEMES = {
  BAUHAUS_MANUFAKTUR: 'bauhaus_manufaktur' as const,
  PREMIUM_ANTHRAZIT: 'premium_anthrazit' as const,
  WARMES_BURGUND: 'warmes_burgund' as const,
};
