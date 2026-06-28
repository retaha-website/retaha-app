import type { AstroCookies } from 'astro';
import { getUserHotels, createSupabaseServerInstance } from '@retaha/auth';

export interface BrandPalette {
  hover:    string;
  soft:     string;
  onAccent: string;
}

/** Deterministisch aus Primärfarbe abgeleitet — keine DB-Spalte nötig. */
export function computeBrandPalette(hex: string): BrandPalette {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { hover: '#0e4d57', soft: 'rgba(20,97,110,0.12)', onAccent: '#ffffff' };
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  function mixWhite(t: number) {
    const mr = Math.round(r + (255 - r) * t);
    const mg = Math.round(g + (255 - g) * t);
    const mb = Math.round(b + (255 - b) * t);
    return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
  }

  function sRGB(c: number) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  const lum = 0.2126 * sRGB(r) + 0.7152 * sRGB(g) + 0.0722 * sRGB(b);

  return {
    hover:    mixWhite(0.65),
    soft:     mixWhite(0.90),
    onAccent: lum > 0.179 ? '#0A0A0A' : '#FFFFFF',
  };
}

export interface BrandingData {
  hotel_id: string;
  // Logos
  logo_primary:    string | null;
  logo_icon:       string | null;
  logo_wordmark:   string | null;
  logo_dark:       string | null;
  logo_print:      string | null;
  logo_spacing:    'tight' | 'normal' | 'loose';
  // Farben
  brand_primary:   string;
  // Theme (legacy)
  brand_theme:     'coffee' | 'ocean' | 'forest' | 'custom';
  // Design-Identität
  design_identity: 'classic' | 'bauhaus' | 'editorial';
  // Assets
  splash_background: string | null;
  wallet_pass_bg:    string | null;
  email_header:      string | null;
}

export async function getBranding(
  cookies: AstroCookies,
  request: Request,
): Promise<BrandingData | null> {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return null;

  const client = createSupabaseServerInstance(cookies, request);
  const { data } = await client
    .from('hotels')
    .select(`
      id,
      logo_primary, logo_icon, logo_wordmark, logo_dark, logo_print, logo_spacing,
      brand_primary,
      brand_theme, design_identity,
      splash_background, wallet_pass_bg, email_header
    `)
    .eq('id', hotel.id)
    .maybeSingle();

  const d = (data ?? {}) as Record<string, unknown>;

  return {
    hotel_id:          hotel.id,
    logo_primary:      (d.logo_primary as string) ?? null,
    logo_icon:         (d.logo_icon as string) ?? null,
    logo_wordmark:     (d.logo_wordmark as string) ?? null,
    logo_dark:         (d.logo_dark as string) ?? null,
    logo_print:        (d.logo_print as string) ?? null,
    logo_spacing:      ((d.logo_spacing as string) ?? 'normal') as 'tight' | 'normal' | 'loose',
    brand_primary:     (d.brand_primary as string) ?? '#14616E',
    brand_theme:       ((d.brand_theme as string) ?? 'coffee') as 'coffee' | 'ocean' | 'forest' | 'custom',
    design_identity:   ((d.design_identity as string) ?? 'classic') as 'classic' | 'bauhaus' | 'editorial',
    splash_background: (d.splash_background as string) ?? null,
    wallet_pass_bg:    (d.wallet_pass_bg as string) ?? null,
    email_header:      (d.email_header as string) ?? null,
  };
}
