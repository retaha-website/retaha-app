import type { LanguageCode } from '@retaha/i18n';

export type UserRole = 'owner' | 'manager' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  hotel_id: string;
  hotel_name: string;
  hotel_logo_url: string | null;
  hotel_trial_started_at: string | null;
  hotel_trial_ends_at: string | null;
  hotel_subscription_status: string;
  hotel_plan: string;
  hotel_theme: string | null;
  avatar_url: string | null;
  language: LanguageCode;
}

export function getInitials(profile: UserProfile): string {
  const f = profile.first_name?.[0] ?? '';
  const l = profile.last_name?.[0] ?? '';
  const combined = (f + l).toUpperCase();
  return combined || profile.email[0]?.toUpperCase() || 'U';
}

/** Nur die Vornamen-Initiale (Fallback E-Mail). Für die Avatar-Anzeige. */
export function getFirstInitial(profile: UserProfile): string {
  return (profile.first_name?.[0] || profile.email?.[0] || 'U').toUpperCase();
}

export function getDisplayName(profile: UserProfile): string {
  const full = `${profile.first_name} ${profile.last_name}`.trim();
  return full || profile.email;
}
