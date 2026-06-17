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

export const menuSections: MenuSection[] = [
  {
    title: 'Gäste-App Konfig',
    items: [
      {
        label: 'Branding',
        sub: 'Logo · Farben · Theme',
        href: '/branding',
        icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="m8 12 2 2 4-4"/>'),
      },
      {
        label: 'Module',
        sub: 'Features an/aus',
        href: '/features',
        icon: icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
      },
      {
        label: 'Loyalty',
        sub: 'Punkte · Stufen · Prämien',
        href: '/loyalty',
        icon: icon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
      },
      {
        label: 'Hero-Karten',
        sub: 'Action-Cards · Swipe',
        href: '/action-cards',
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'Showcase',
        sub: 'Zimmer · Fotos',
        href: '/showcase',
        icon: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
      },
    ],
  },
  {
    title: 'Inhalte',
    items: [
      {
        label: 'Empfehlungen',
        sub: 'Places · Tipps',
        href: '/places',
        icon: icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
      },
      {
        label: 'Frühstück',
        sub: 'Buchungen · Zeiten',
        href: '/breakfast',
        icon: icon('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
      },
      {
        label: 'Konferenz',
        sub: 'Räume · Buchungen',
        href: '/conference',
        icon: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3L12 7 8 3"/>'),
      },
      {
        label: 'Speisekarte',
        sub: 'Menü · Gerichte',
        href: '/menu',
        icon: icon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
      },
    ],
  },
  {
    title: 'Eve KI',
    items: [
      {
        label: 'Knowledge Base',
        sub: 'Hotel-Wissen · FAQ',
        href: '/eve/knowledge',
        icon: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
      },
      {
        label: 'Eve Einstellungen',
        sub: 'Ton · Verhalten',
        href: '/eve/settings',
        icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>'),
      },
      {
        label: 'Eve Feedback',
        sub: 'Bewertungen · Logs',
        href: '/eve/feedback',
        icon: icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
      },
    ],
  },
  {
    title: 'Stay-Pushes & Tools',
    items: [
      {
        label: 'Stay-Pushes',
        sub: 'Automatische Nachrichten',
        href: '/stay-pushes',
        icon: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
      },
      {
        label: 'Feedback-Anfragen',
        sub: 'Bewertungen · Reviews',
        href: '/feedback',
        icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      },
      {
        label: 'NFC-Tags',
        sub: 'Karten · Schlüssel',
        href: '/nfc-tags',
        icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
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
