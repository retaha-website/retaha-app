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
        href: '/admin/team',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      },
      {
        label: 'Team-Security',
        sub: '2FA · MFA-Pflicht',
        href: '/admin/team-security',
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
        href: '/admin/subscription',
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
        href: '/admin/pms',
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'Booking-Engine',
        sub: 'Direktbuchungen',
        href: '/admin/booking-engine',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
      {
        label: 'Best-Price',
        sub: 'Preisgarantie',
        href: '/admin/best-price',
        icon: icon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      },
      {
        label: 'Booking-Recovery',
        sub: 'Abbruch-Recovery',
        href: '/admin/booking-recovery',
        icon: icon('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/>'),
      },
      {
        label: 'Self-Checkout',
        sub: 'Automatisierter Check-out',
        href: '/admin/self-checkout',
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
        href: '/admin/sicherheit',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),
      },
    ],
  },
  {
    title: 'Legal',
    items: [
      {
        label: 'AGB',
        href: '/admin/agb',
        icon: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
      },
      {
        label: 'Datenschutz',
        href: '/admin/datenschutz',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
      },
      {
        label: 'Impressum',
        href: '/admin/impressum',
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
