// Sprint H · Group 1 — Theme-Helper
//
// Drei Themes auswählbar pro Hotel. Helper resolveTheme() löst Theme aus
// (a) Preview-Query-Param `?preview_theme=X` (für Preview-Tab im Theme-
//     Picker — wird NICHT persistiert)
// (b) hotels.theme aus DB
// (c) Default 'bauhaus_manufaktur'
//
// SSR-Injection: alle Layouts setzen <html data-theme={theme}>.

export type ThemeId = 'bauhaus_manufaktur' | 'premium_anthrazit' | 'warmes_burgund';

export const THEMES: ThemeId[] = ['bauhaus_manufaktur', 'premium_anthrazit', 'warmes_burgund'];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export interface ThemeDescriptor {
  id: ThemeId;
  label: string;
  charakter: string;
  /** Hex-Color für Mini-Preview-Swatch im Picker */
  swatchBrand: string;
  swatchBg: string;
  fontFamilyLabel: string;
}

export const THEME_DESCRIPTORS: Record<ThemeId, ThemeDescriptor> = {
  bauhaus_manufaktur: {
    id: 'bauhaus_manufaktur',
    label: 'Bauhaus Manufaktur',
    charakter: 'Klassisch retaha — präzise, handwerklich, Pink-Shock-DNA. Aktueller Default.',
    swatchBrand: '#FF4A82',
    swatchBg: '#FFFFFF',
    fontFamilyLabel: 'Space Grotesk',
  },
  premium_anthrazit: {
    id: 'premium_anthrazit',
    label: 'Premium Anthrazit',
    charakter: 'High-End Boutique-Hotel-Feel. Sehr reduziert mit goldenem Akzent.',
    swatchBrand: '#1A1A1A',
    swatchBg: '#FAFAFA',
    fontFamilyLabel: 'Inter Tight',
  },
  warmes_burgund: {
    id: 'warmes_burgund',
    label: 'Warmes Burgund',
    charakter: 'Klassisch elegant — traditionelles Hotel, einladend, Cream-Background, Serif-Headlines.',
    swatchBrand: '#8C2128',
    swatchBg: '#FFFCF7',
    fontFamilyLabel: 'Cormorant Garamond',
  },
};

/**
 * Resolve das aktive Theme aus URL-Query (Preview) + Hotel-Setting.
 * Preview hat Vorrang, persistiert wird nichts.
 */
export function resolveTheme(opts: {
  hotelTheme: string | null | undefined;
  requestUrl?: URL | string;
}): ThemeId {
  if (opts.requestUrl) {
    try {
      const url = typeof opts.requestUrl === 'string' ? new URL(opts.requestUrl) : opts.requestUrl;
      const preview = url.searchParams.get('preview_theme');
      if (preview && isThemeId(preview)) return preview;
    } catch { /* ignore */ }
  }
  if (isThemeId(opts.hotelTheme)) return opts.hotelTheme;
  return 'bauhaus_manufaktur';
}
