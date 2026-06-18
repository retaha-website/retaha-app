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
        label: 'Module',
        sub: 'Features an/aus',
        href: '/features',
        icon: icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
      },
      {
        label: 'Test-Gast',
        sub: 'App als Gast erleben',
        href: '/showcase',
        icon: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
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
