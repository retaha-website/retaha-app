import { getUser, getUserHotels, createSupabaseServerInstance } from '@retaha/auth';
import type { AstroCookies } from 'astro';

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
  brand_secondary: string | null;
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
      brand_primary, brand_secondary,
      brand_theme, design_identity,
      splash_background, wallet_pass_bg, email_header
    `)
    .eq('id', hotel.id)
    .maybeSingle();

  if (!data) return null;
  const d = data as Record<string, unknown>;

  return {
    hotel_id:          hotel.id,
    logo_primary:      (d.logo_primary as string) ?? null,
    logo_icon:         (d.logo_icon as string) ?? null,
    logo_wordmark:     (d.logo_wordmark as string) ?? null,
    logo_dark:         (d.logo_dark as string) ?? null,
    logo_print:        (d.logo_print as string) ?? null,
    logo_spacing:      ((d.logo_spacing as string) ?? 'normal') as 'tight' | 'normal' | 'loose',
    brand_primary:     (d.brand_primary as string) ?? '#FF4A82',
    brand_secondary:   (d.brand_secondary as string) ?? null,
    brand_theme:       ((d.brand_theme as string) ?? 'coffee') as 'coffee' | 'ocean' | 'forest' | 'custom',
    design_identity:   ((d.design_identity as string) ?? 'classic') as 'classic' | 'bauhaus' | 'editorial',
    splash_background: (d.splash_background as string) ?? null,
    wallet_pass_bg:    (d.wallet_pass_bg as string) ?? null,
    email_header:      (d.email_header as string) ?? null,
  };
}
