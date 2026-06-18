export interface MenuItem {
  label: string;
  sub?: string;
  href: string;
  icon: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

// Loyalty-Config lebt in der Gäste-App (HotelierLayout) — Cross-Domain-Link wie der
// "gast-ansicht"-Tab. Gleiche Subdomain-Auth (*.retaha.de) → Session greift.
const GUEST_APP = import.meta.env.GUEST_APP_URL ?? 'https://app.retaha.de';

export const menuSections: MenuSection[] = [
  {
    title: 'Übersicht',
    items: [
      {
        label: 'Dashboard',
        sub: 'Backoffice-Start',
        href: '/uebersicht',
        icon: icon('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
      },
    ],
  },
  {
    title: 'Marketing',
    items: [
      {
        label: 'Marketing',
        sub: 'Kampagnen · Drips · Übersicht',
        href: '/marketing',
        icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
      },
      {
        label: 'Abonnenten & Consent',
        sub: 'Newsletter-Opt-ins · Waitlist · DSGVO',
        href: '/marketing/consent',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>'),
      },
      {
        label: 'Email-Domain',
        sub: 'Eigene Absender-Adresse',
        href: '/email-domain',
        icon: icon('<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z"/><path d="M22 10l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>'),
      },
    ],
  },
  {
    title: 'Gäste-Module',
    items: [
      {
        label: 'Frühstück',
        sub: 'Zeiten · Speisekarte · Preis',
        href: '/breakfast',
        icon: icon('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
      },
      {
        label: 'Eve Concierge',
        sub: 'KI-Chat für Gäste',
        href: '/eve/knowledge',
        icon: icon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>'),
      },
      {
        label: 'Service-Anfragen',
        sub: 'Zimmerwünsche · Items konfigurieren',
        href: '/service-items',
        icon: icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
      },
      {
        label: 'Empfehlungen',
        sub: 'Google Places · Tipps',
        href: '/places',
        icon: icon('<circle cx="12" cy="11" r="3"/><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>'),
      },
      {
        label: 'Self-Checkout',
        sub: 'Digitale Abreise',
        href: '/self-checkout',
        icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
      },
      {
        label: 'Wallet-Pass',
        sub: 'Apple & Google Wallet',
        href: '/wallet-keys',
        icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
      },
      {
        label: 'Loyalty',
        sub: 'Punkte · Stufen · Prämien',
        href: `${GUEST_APP}/loyalty`,
        icon: icon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
      },
      {
        label: 'Hero-Karten',
        sub: 'Action-Cards · Swipe',
        href: `${GUEST_APP}/action-cards`,
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'Branding',
        sub: 'Logo · Farben · Theme',
        href: `${GUEST_APP}/branding`,
        icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="m8 12 2 2 4-4"/>'),
      },
      {
        label: 'Konferenz',
        sub: 'Räume · Buchungen',
        href: '/conference',
        icon: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3L12 7 8 3"/>'),
      },
    ],
  },
  {
    title: 'Stay-Pushes & Tools',
    items: [
      {
        label: 'Stay-Pushes',
        sub: 'Automatische Nachrichten',
        href: `${GUEST_APP}/stay-pushes`,
        icon: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
      },
      {
        label: 'NFC-Tags',
        sub: 'Karten · Schlüssel',
        href: `${GUEST_APP}/nfc-tags`,
        icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
      },
    ],
  },
  {
    title: 'Hotel',
    items: [
      {
        label: 'Allgemein',
        sub: 'Name · Adresse · Sprache',
        href: '/admin/settings',
        icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
      },
      {
        label: 'Team',
        sub: 'Mitglieder · Rollen',
        href: '/team',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      },
      {
        label: 'Team-Security',
        sub: '2FA · MFA-Pflicht',
        href: '/team-security',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
      },
    ],
  },
  {
    title: 'Abrechnung',
    items: [
      {
        label: 'Abonnement',
        sub: 'Plan · Rechungen',
        href: '/subscription',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
    ],
  },
  {
    title: 'Integrationen',
    items: [
      {
        label: 'PMS',
        sub: 'Apaleo · Protel',
        href: '/pms',
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'Booking-Engine',
        sub: 'Direktbuchungen',
        href: '/booking-engine',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
      {
        label: 'Best-Price',
        sub: 'Preisgarantie',
        href: '/best-price',
        icon: icon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      },
      {
        label: 'Booking-Recovery',
        sub: 'Abbruch-Recovery',
        href: '/booking-recovery',
        icon: icon('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/>'),
      },
      {
        label: 'Self-Checkout',
        sub: 'Automatisierter Check-out',
        href: '/self-checkout',
        icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
      },
    ],
  },
  {
    title: 'Sicherheit',
    items: [
      {
        label: 'Audit-Log',
        sub: 'Aktivitäten · Zugriffe',
        href: '/sicherheit',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),
      },
    ],
  },
  {
    title: 'Legal',
    items: [
      {
        label: 'AGB',
        href: '/agb',
        icon: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
      },
      {
        label: 'Datenschutz',
        href: '/datenschutz',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
      },
      {
        label: 'Impressum',
        href: '/impressum',
        icon: icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
      },
    ],
  },
  {
    title: 'Konto',
    items: [
      {
        label: 'Mein Profil',
        href: '/profil',
        icon: icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
      },
      {
        label: 'Benachrichtigungen',
        href: '/benachrichtigungen',
        icon: icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
      },
      {
        label: 'Abmelden',
        href: '/api/auth/logout',
        icon: icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
      },
    ],
  },
];
