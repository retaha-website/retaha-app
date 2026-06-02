import type { AdminLocale, GuestLocale, AddressForm } from './types';
import { DEFAULT_ADMIN_LOCALE, DEFAULT_GUEST_LOCALE } from './constants';

// Eager-imports — alle 10 Admin-Locales + 4 Guest-Locales als JSON-Module
import deAdmin from './locales/admin/de.json';
import enAdmin from './locales/admin/en.json';
import frAdmin from './locales/admin/fr.json';
import esAdmin from './locales/admin/es.json';
import itAdmin from './locales/admin/it.json';
import nlAdmin from './locales/admin/nl.json';
import ptAdmin from './locales/admin/pt.json';
import plAdmin from './locales/admin/pl.json';
import trAdmin from './locales/admin/tr.json';
import arAdmin from './locales/admin/ar.json';

import deGuest from './locales/guest/de.json';
import enGuest from './locales/guest/en.json';
import frGuest from './locales/guest/fr.json';
import esGuest from './locales/guest/es.json';

type TranslationDict = Record<string, unknown>;

const ADMIN_TRANSLATIONS: Record<AdminLocale, TranslationDict> = {
  de: deAdmin,
  en: enAdmin,
  fr: frAdmin,
  es: esAdmin,
  it: itAdmin,
  nl: nlAdmin,
  pt: ptAdmin,
  pl: plAdmin,
  tr: trAdmin,
  ar: arAdmin,
};

const GUEST_TRANSLATIONS: Record<GuestLocale, TranslationDict> = {
  de: deGuest,
  en: enGuest,
  fr: frGuest,
  es: esGuest,
};

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Backoffice-Translation.
 * Fallback-Reihenfolge: target-locale → DE → Key selbst (sichtbar als "module.key" für Debugging)
 */
export function t(key: string, locale: AdminLocale = DEFAULT_ADMIN_LOCALE): string {
  const inTarget = getNestedValue(ADMIN_TRANSLATIONS[locale], key);
  if (typeof inTarget === 'string') return inTarget;

  if (locale !== DEFAULT_ADMIN_LOCALE) {
    const inDe = getNestedValue(ADMIN_TRANSLATIONS[DEFAULT_ADMIN_LOCALE], key);
    if (typeof inDe === 'string') return inDe;
  }

  return key;
}

/**
 * Gast-Frontend-Translation mit Du/Sie-Branching.
 * Erwartet: Werte sind entweder { du: "...", sie: "..." }-Objekt ODER ein plain String
 * (für Fälle ohne Anrede-Wechsel wie "Reservieren").
 *
 * In Sub-Phase 6.E werden die JSON-Files mit dieser Struktur befüllt.
 */
export function tGuest(
  key: string,
  locale: GuestLocale = DEFAULT_GUEST_LOCALE,
  addressForm: AddressForm = 'sie',
): string {
  const inTarget = getNestedValue(GUEST_TRANSLATIONS[locale], key);

  if (inTarget && typeof inTarget === 'object' && addressForm in inTarget) {
    const variant = (inTarget as Record<string, unknown>)[addressForm];
    if (typeof variant === 'string') return variant;
  }
  if (typeof inTarget === 'string') return inTarget;

  if (locale !== DEFAULT_GUEST_LOCALE) {
    const inDe = getNestedValue(GUEST_TRANSLATIONS[DEFAULT_GUEST_LOCALE], key);
    if (inDe && typeof inDe === 'object' && addressForm in inDe) {
      const variant = (inDe as Record<string, unknown>)[addressForm];
      if (typeof variant === 'string') return variant;
    }
    if (typeof inDe === 'string') return inDe;
  }

  return key;
}
