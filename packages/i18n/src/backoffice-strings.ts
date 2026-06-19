// Backoffice-UI-Strings (Hotelier-Seite) — getrennt von den Gast-Strings in core.ts.
// DE = Source-of-Truth (handgepflegt). EN/TR handgepflegt. Restliche Sprachen
// werden phasenweise ergänzt (Translate-Script) — fehlende Keys fallen via bt()
// sauber auf DE zurück.
//
// Aufruf:  bt('dd.profile', lang)
import { type LanguageCode } from './helpers/types';

export const BO_STRINGS: Partial<Record<LanguageCode, Record<string, string>>> = {
  de: {
    // Account-Dropdown (UserDropdown.astro)
    'dd.profile': 'Mein Profil',
    'dd.profile.sub': 'Name · E-Mail · Passwort',
    'dd.security': 'Sicherheit & 2FA',
    'dd.security.sub': 'Passwort · Zwei-Faktor',
    'dd.notifications': 'Benachrichtigungen',
    'dd.notifications.sub': 'E-Mail · Push · WhatsApp',
    'dd.language': 'Sprache',
    'dd.language.choose': 'Sprache wählen',
    'dd.help': 'Hilfe & Support',
    'dd.help.sub': 'WhatsApp · Mail · Docs',
    'dd.logout': 'Abmelden',
    'menu.avatar.open': 'Account-Menü öffnen',
  },
  en: {
    'dd.profile': 'My Profile',
    'dd.profile.sub': 'Name · Email · Password',
    'dd.security': 'Security & 2FA',
    'dd.security.sub': 'Password · Two-Factor',
    'dd.notifications': 'Notifications',
    'dd.notifications.sub': 'Email · Push · WhatsApp',
    'dd.language': 'Language',
    'dd.language.choose': 'Choose language',
    'dd.help': 'Help & Support',
    'dd.help.sub': 'WhatsApp · Mail · Docs',
    'dd.logout': 'Log out',
    'menu.avatar.open': 'Open account menu',
  },
  tr: {
    'dd.profile': 'Profilim',
    'dd.profile.sub': 'Ad · E-posta · Şifre',
    'dd.security': 'Güvenlik & 2FA',
    'dd.security.sub': 'Şifre · İki faktör',
    'dd.notifications': 'Bildirimler',
    'dd.notifications.sub': 'E-posta · Push · WhatsApp',
    'dd.language': 'Dil',
    'dd.language.choose': 'Dil seçin',
    'dd.help': 'Yardım & Destek',
    'dd.help.sub': 'WhatsApp · Mail · Dokümanlar',
    'dd.logout': 'Çıkış yap',
    'menu.avatar.open': 'Hesap menüsünü aç',
  },
};

/**
 * Backoffice-Translate. Fallback-Kette: gewählte Sprache → DE → Key selbst
 * (damit nie ein leerer String oder ein Key-Leak entsteht).
 */
export function bt(key: string, lang: LanguageCode): string {
  return BO_STRINGS[lang]?.[key] ?? BO_STRINGS.de?.[key] ?? key;
}
