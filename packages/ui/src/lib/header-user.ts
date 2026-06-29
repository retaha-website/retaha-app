// Geteilter Header-User-Typ + Helfer (von Backoffice + Gast-App genutzt).
// Die Backoffice-UserProfile ist ein Superset hiervon → strukturell kompatibel.
import type { LanguageCode } from '@retaha/i18n';

export interface HeaderUser {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  hotel_name: string;
  hotel_logo_url: string | null;
  hotel_plan: string;
  hotel_qr_notif_pending: boolean;
  hotel_onboarding_done: boolean;
  hotel_setup_skipped: boolean;
  hotel_dismissed_dash_cards: string[];
  avatar_url: string | null;
  language: LanguageCode;
}

export function getInitials(p: { first_name?: string; last_name?: string; email?: string }): string {
  const f = p.first_name?.[0] ?? '';
  const l = p.last_name?.[0] ?? '';
  const combined = (f + l).toUpperCase();
  return combined || (p.email?.[0]?.toUpperCase() ?? 'U');
}

export function getFirstInitial(p: { first_name?: string; email?: string }): string {
  return (p.first_name?.[0] || p.email?.[0] || 'U').toUpperCase();
}

export function getDisplayName(p: { first_name?: string; last_name?: string; email?: string }): string {
  const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return full || (p.email ?? '');
}
