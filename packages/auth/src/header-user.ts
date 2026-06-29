// Geteilter Header-Profil-Lader — liefert genau die Felder, die der geteilte
// App-Header (@retaha/ui Header.astro / HeaderUser) braucht. Genutzt von Backoffice
// UND Gast-App, damit beide identische Hotel-/User-Daten anzeigen.
import type { AstroCookies } from 'astro';
import { createSupabaseServerInstance } from './server';

export interface HeaderUserData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  hotel_id: string;
  hotel_name: string;
  hotel_logo_url: string | null;
  hotel_plan: string;
  hotel_qr_notif_pending: boolean;
  hotel_onboarding_done: boolean;
  hotel_setup_skipped: boolean;
  hotel_dismissed_dash_cards: string[];
  avatar_url: string | null;
  /** Sprachcode (vom Aufrufer aufgelöst — Cookie/URL/Accept-Language). */
  language: string;
}

/**
 * Lädt das Header-Profil (User + erstes Hotel) für die geteilte Navbar.
 * `lang` wird vom Aufrufer aufgelöst (Backoffice: getLang; Gast: gleiche Cookie-Kette).
 */
export async function getHeaderUser(
  cookies: AstroCookies,
  request: Request,
  lang: string,
): Promise<HeaderUserData | null> {
  const supabase = createSupabaseServerInstance(cookies, request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileResult, hotelUserResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('hotel_users')
      .select('role, hotels(id, name, logo_primary, logo_dark, plan, qr_notif_pending, onboarding_done, setup_skipped)')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as { first_name?: string; last_name?: string } | null;
  const hotelUser = hotelUserResult.data as {
    role: string;
    hotels: {
      id: string;
      name: string;
      logo_primary?: string;
      logo_dark?: string;
      plan?: string;
      qr_notif_pending?: boolean;
      onboarding_done?: boolean;
      setup_skipped?: boolean;
    } | null;
  } | null;

  const h = hotelUser?.hotels;

  // dismissed_dash_cards separat + fehlertolerant laden — fehlt die Spalte (alte DB),
  // bleibt es leer statt das Layout abzubrechen.
  let dismissedCards: string[] = [];
  if (h?.id) {
    const { data: dcRow } = await supabase
      .from('hotels').select('dismissed_dash_cards').eq('id', h.id).maybeSingle();
    if (Array.isArray((dcRow as any)?.dismissed_dash_cards)) dismissedCards = (dcRow as any).dismissed_dash_cards;
  }

  return {
    email: user.email ?? '',
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    role: hotelUser?.role ?? 'staff',
    hotel_id: h?.id ?? '',
    hotel_name: h?.name ?? '',
    hotel_logo_url: h?.logo_primary ?? h?.logo_dark ?? null,
    hotel_plan: h?.plan ?? 'lite',
    hotel_qr_notif_pending: h?.qr_notif_pending ?? false,
    hotel_onboarding_done: h?.onboarding_done ?? false,
    hotel_setup_skipped: h?.setup_skipped ?? false,
    hotel_dismissed_dash_cards: dismissedCards,
    avatar_url: ((user.user_metadata as Record<string, unknown> | undefined)?.avatar_url as string | undefined) ?? null,
    language: lang,
  };
}
