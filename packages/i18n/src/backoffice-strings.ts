// Backoffice-UI-Strings (Hotelier-Seite) — DE = Source-of-Truth (handgepflegt).
// Übrige Sprachen via scripts/translate-backoffice-strings.mjs (Haiku). Fehlende
// Keys fallen via bt() sauber auf DE zurück.
//
// Aufruf:  bt('dd.profile', lang)
import { type LanguageCode } from './helpers/types';

export const BO_STRINGS: Partial<Record<LanguageCode, Record<string, string>>> = {
  de: {
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
    'menu.avatar.open': 'Account-Menü öffnen'
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
    'menu.avatar.open': 'Open account menu'
  },
  fr: {
    'dd.profile': 'Mon profil',
    'dd.profile.sub': 'Nom · E-mail · Mot de passe',
    'dd.security': 'Sécurité & 2FA',
    'dd.security.sub': 'Mot de passe · Deux facteurs',
    'dd.notifications': 'Notifications',
    'dd.notifications.sub': 'E-mail · Push · WhatsApp',
    'dd.language': 'Langue',
    'dd.language.choose': 'Choisir la langue',
    'dd.help': 'Aide & Support',
    'dd.help.sub': 'WhatsApp · Mail · Docs',
    'dd.logout': 'Déconnexion',
    'menu.avatar.open': 'Ouvrir le menu du compte'
  },
  es: {
    'dd.profile': 'Mi perfil',
    'dd.profile.sub': 'Nombre · Correo electrónico · Contraseña',
    'dd.security': 'Seguridad y 2FA',
    'dd.security.sub': 'Contraseña · Dos factores',
    'dd.notifications': 'Notificaciones',
    'dd.notifications.sub': 'E-mail · Push · WhatsApp',
    'dd.language': 'Idioma',
    'dd.language.choose': 'Seleccionar idioma',
    'dd.help': 'Ayuda y soporte',
    'dd.help.sub': 'WhatsApp · Correo · Documentos',
    'dd.logout': 'Cerrar sesión',
    'menu.avatar.open': 'Abrir menú de cuenta'
  },
  it: {
    'dd.profile': 'Il mio profilo',
    'dd.profile.sub': 'Nome · Email · Password',
    'dd.security': 'Sicurezza e 2FA',
    'dd.security.sub': 'Password · Two-Factor',
    'dd.notifications': 'Notifiche',
    'dd.notifications.sub': 'E-mail · Push · WhatsApp',
    'dd.language': 'Lingua',
    'dd.language.choose': 'Seleziona lingua',
    'dd.help': 'Aiuto e supporto',
    'dd.help.sub': 'WhatsApp · Mail · Documenti',
    'dd.logout': 'Disconnetti',
    'menu.avatar.open': 'Apri menu account'
  },
  pt: {
    'dd.profile': 'Meu perfil',
    'dd.profile.sub': 'Nome · E-Mail · Senha',
    'dd.security': 'Segurança & 2FA',
    'dd.security.sub': 'Senha · Autenticação de dois fatores',
    'dd.notifications': 'Notificações',
    'dd.notifications.sub': 'E-mail · Push · WhatsApp',
    'dd.language': 'Idioma',
    'dd.language.choose': 'Escolher idioma',
    'dd.help': 'Ajuda e Suporte',
    'dd.help.sub': 'WhatsApp · E-mail · Documentos',
    'dd.logout': 'Sair',
    'menu.avatar.open': 'Abrir menu da conta'
  },
  nl: {
    'dd.profile': 'Mijn profiel',
    'dd.profile.sub': 'Naam · E-mail · Wachtwoord',
    'dd.security': 'Beveiliging & 2FA',
    'dd.security.sub': 'Wachtwoord · Twee-factor',
    'dd.notifications': 'Meldingen',
    'dd.notifications.sub': 'E-mail · Push · WhatsApp',
    'dd.language': 'Taal',
    'dd.language.choose': 'Taal selecteren',
    'dd.help': 'Hulp & Support',
    'dd.help.sub': 'WhatsApp · E-mail · Docs',
    'dd.logout': 'Afmelden',
    'menu.avatar.open': 'Account-menu openen'
  },
  ru: {
    'dd.profile': 'Мой профиль',
    'dd.profile.sub': 'Имя · E-Mail · Пароль',
    'dd.security': 'Безопасность и 2FA',
    'dd.security.sub': 'Пароль · Двухфакторная аутентификация',
    'dd.notifications': 'Уведомления',
    'dd.notifications.sub': 'Электронная почта · Push · WhatsApp',
    'dd.language': 'Язык',
    'dd.language.choose': 'Выберите язык',
    'dd.help': 'Справка и поддержка',
    'dd.help.sub': 'WhatsApp · Mail · Docs',
    'dd.logout': 'Выход',
    'menu.avatar.open': 'Открыть меню аккаунта'
  },
  ar: {
    'dd.profile': 'ملفي الشخصي',
    'dd.profile.sub': 'الاسم · البريد الإلكتروني · كلمة المرور',
    'dd.security': 'الأمان والمصادقة الثنائية',
    'dd.security.sub': 'كلمة المرور · المصادقة الثنائية',
    'dd.notifications': 'إشعارات',
    'dd.notifications.sub': 'البريد الإلكتروني · الإشعار · WhatsApp',
    'dd.language': 'اللغة',
    'dd.language.choose': 'اختيار اللغة',
    'dd.help': 'المساعدة والدعم',
    'dd.help.sub': 'WhatsApp · بريد · مستندات',
    'dd.logout': 'تسجيل الخروج',
    'menu.avatar.open': 'فتح قائمة الحساب'
  },
  zh: {
    'dd.profile': '我的资料',
    'dd.profile.sub': '名称 · 电子邮件 · 密码',
    'dd.security': '安全和 2FA',
    'dd.security.sub': '密码 · 双因素认证',
    'dd.notifications': '通知',
    'dd.notifications.sub': '电子邮件 · 推送 · WhatsApp',
    'dd.language': '语言',
    'dd.language.choose': '选择语言',
    'dd.help': '帮助与支持',
    'dd.help.sub': 'WhatsApp · 邮件 · 文档',
    'dd.logout': '登出',
    'menu.avatar.open': '打开账户菜单'
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
    'menu.avatar.open': 'Hesap menüsünü aç'
  }
};

/**
 * Backoffice-Translate. Fallback-Kette: gewählte Sprache → DE → Key selbst
 * (damit nie ein leerer String oder ein Key-Leak entsteht).
 */
export function bt(key: string, lang: LanguageCode): string {
  return BO_STRINGS[lang]?.[key] ?? BO_STRINGS.de?.[key] ?? key;
}
