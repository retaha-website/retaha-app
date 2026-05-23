import type { AdminLocale, GuestLocale } from './types';

export const SUPPORTED_ADMIN_LOCALES: AdminLocale[] = [
  'de', 'en', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'tr', 'ar',
];

export const SUPPORTED_GUEST_LOCALES: GuestLocale[] = ['de', 'en', 'fr', 'es'];

export const RTL_LOCALES: AdminLocale[] = ['ar'];

export const LOCALE_LABELS: Record<AdminLocale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  pl: 'Polski',
  tr: 'Türkçe',
  ar: 'العربية',
};

export const LOCALE_CODES: Record<AdminLocale, string> = {
  de: 'DE',
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  nl: 'NL',
  pt: 'PT',
  pl: 'PL',
  tr: 'TR',
  ar: 'AR',
};

export const DEFAULT_ADMIN_LOCALE: AdminLocale = 'de';
export const DEFAULT_GUEST_LOCALE: GuestLocale = 'de';
export const DEFAULT_ADDRESS_FORM = 'sie' as const;
