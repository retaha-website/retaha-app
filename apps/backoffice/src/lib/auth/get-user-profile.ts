import type { AstroCookies } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';
import type { UserProfile, UserRole } from '../types/user';

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
      .select('role, hotels(id, name, logo_primary, logo_dark, trial_started_at, subscription_status, theme)')
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
      subscription_status?: string;
      theme?: string | null;
    } | null;
  } | null;

  const h = hotelUser?.hotels;
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
    hotel_subscription_status: h?.subscription_status ?? '',
    hotel_theme: h?.theme ?? null,
    language: 'de',
  };
}
