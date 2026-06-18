export interface MenuItem {
  label: string;
  sub?: string;
  href: string;
  icon: string;
  comingSoon?: boolean;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

export const menuSections: MenuSection[] = [
  {
    title: 'Operations',
    items: [
      {
        label: 'Buchungen',
        sub: 'Check-ins · Reservierungen',
        href: '/app/bookings',
        icon: icon('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
      },
      {
        label: 'Service-Anfragen',
        sub: 'Aufgaben · Anfragen',
        href: '/app/service',
        icon: icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
      },
      {
        label: 'QR-Codes',
        sub: 'Generieren · Drucken',
        href: '/app/qr',
        icon: icon('<rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>'),
      },
      {
        label: 'Feedback-Anfragen',
        sub: 'Bewertungen · Reviews',
        href: '/app/feedback',
        icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      },
    ],
  },
  {
    title: 'Überwachung',
    items: [
      {
        label: 'Live-Übersicht',
        sub: 'Bald verfügbar',
        href: '#',
        comingSoon: true,
        icon: icon('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
      },
      {
        label: 'Alerts',
        sub: 'Bald verfügbar',
        href: '#',
        comingSoon: true,
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
