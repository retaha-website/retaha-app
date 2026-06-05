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
  language: 'de' | 'en';
}

export function getInitials(profile: UserProfile): string {
  const f = profile.first_name?.[0] ?? '';
  const l = profile.last_name?.[0] ?? '';
  const combined = (f + l).toUpperCase();
  return combined || profile.email[0]?.toUpperCase() || 'U';
}

export function getDisplayName(profile: UserProfile): string {
  const full = `${profile.first_name} ${profile.last_name}`.trim();
  return full || profile.email;
}
