import type { AstroCookies } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';
import type { UserProfile, UserRole } from '../types/user';
import { getLang } from '../i18n';

export async function getUserProfileForLayout(
  cookies: AstroCookies,
  request: Request,
): Promise<UserProfile | null> {
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
      .select('role, hotels(id, name, logo_primary, logo_dark, trial_started_at, trial_ends_at, subscription_status, plan, theme, qr_notif_pending, onboarding_done, setup_skipped)')
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

      trial_started_at?: string | null;
      trial_ends_at?: string | null;
      subscription_status?: string;
      plan?: string;
      theme?: string | null;
      qr_notif_pending?: boolean;
      onboarding_done?: boolean;
      setup_skipped?: boolean;
      dismissed_dash_cards?: string[] | null;
    } | null;
  } | null;

  const h = hotelUser?.hotels;

  // dismissed_dash_cards separat + fehlertolerant laden — die Spalte wird erst mit der
  // Migration angelegt; fehlt sie noch, bleibt es leer (kein Profil-Abbruch im Layout).
  let dismissedCards: string[] = [];
  if (h?.id) {
    const { data: dcRow } = await supabase
      .from('hotels').select('dismissed_dash_cards').eq('id', h.id).maybeSingle();
    if (Array.isArray((dcRow as any)?.dismissed_dash_cards)) dismissedCards = (dcRow as any).dismissed_dash_cards;
  }

  return {
    id: user.id,
    email: user.email ?? '',
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    role: (hotelUser?.role ?? 'staff') as UserRole,
    hotel_id: h?.id ?? '',
    hotel_name: h?.name ?? '',
    hotel_logo_url: h?.logo_primary ?? h?.logo_dark ?? null,
    hotel_trial_started_at: h?.trial_started_at ?? null,
    hotel_trial_ends_at: h?.trial_ends_at ?? null,
    hotel_subscription_status: h?.subscription_status ?? '',
    hotel_plan: h?.plan ?? 'lite',
    hotel_qr_notif_pending: h?.qr_notif_pending ?? false,
    hotel_onboarding_done: h?.onboarding_done ?? false,
    hotel_setup_skipped: h?.setup_skipped ?? false,
    hotel_dismissed_dash_cards: dismissedCards,
    hotel_theme: h?.theme ?? null,
    avatar_url: ((user.user_metadata as Record<string, unknown> | undefined)?.avatar_url as string | undefined) ?? null,
    language: getLang(cookies, request),
  };
}
