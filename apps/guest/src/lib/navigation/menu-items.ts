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
  // „Konto" (Mein Profil + Abmelden) lebt ausschließlich im Account-Icon-Dropdown
  // (UserDropdown) — nicht doppelt im Key-/Burger-Menü.
];
