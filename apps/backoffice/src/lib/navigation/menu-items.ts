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
    title: 'Gäste',
    items: [
      {
        label: 'Concierge',
        sub: 'Anfragen · Chat',
        href: '/admin/concierge',
        icon: icon('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
      },
      {
        label: 'Eve',
        sub: 'KI-Concierge',
        href: '/admin/eve/knowledge',
        icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>'),
      },
      {
        label: 'Empfehlungen',
        sub: 'Places · Tipps',
        href: '/admin/places',
        icon: icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
      },
      {
        label: 'Gäste',
        sub: 'Gästeliste',
        href: '/admin/guests',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      },
      {
        label: 'Wallet',
        sub: 'Wallet-Passes',
        href: '/admin/wallet',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
    ],
  },
  {
    title: 'Buchungen & Services',
    items: [
      {
        label: 'Check-ins',
        href: '/admin/checkins',
        icon: icon('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
      },
      {
        label: 'Bewertungen',
        href: '/admin/feedback',
        icon: icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
      },
      {
        label: 'NFC-Tags',
        sub: 'Karten · Schlüssel',
        href: '/admin/nfc-tags',
        icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
      },
      {
        label: 'Showcase',
        href: '/admin/showcase',
        icon: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
      },
      {
        label: 'Frühstück',
        href: '/admin/breakfast',
        icon: icon('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
      },
      {
        label: 'Menü',
        href: '/admin/menu',
        icon: icon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
      },
      {
        label: 'Service',
        href: '/admin/service',
        icon: icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
      },
      {
        label: 'Spa',
        href: '/admin/spa',
        icon: icon('<path d="M12 22a10 10 0 0 1-10-10c0-5.52 4.48-10 10-10s10 4.48 10 10"/><path d="M12 6v6l4 2"/>'),
      },
      {
        label: 'Restaurant',
        href: '/admin/restaurant',
        icon: icon('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>'),
      },
      {
        label: 'Konferenz',
        href: '/admin/conference',
        icon: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3L12 7 8 3"/>'),
      },
    ],
  },
  {
    title: 'Inhalte',
    items: [
      {
        label: 'Action-Cards',
        sub: 'Hero · Swipe-Cards',
        href: '/admin/action-cards',
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'Microsite',
        href: '/admin/microsite',
        icon: icon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
      },
      {
        label: 'SEO',
        href: '/admin/seo',
        icon: icon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
      },
    ],
  },
  {
    title: 'Marketing',
    items: [
      {
        label: 'Wallet-Marketing',
        href: '/admin/marketing',
        icon: icon('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
      },
      {
        label: 'Stay-Pushes',
        href: '/admin/stay-pushes',
        icon: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
      },
      {
        label: 'E-Mail-Kampagnen',
        href: '/admin/email-campaigns',
        icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
      },
      {
        label: 'Bewertungsanfragen',
        href: '/admin/reviews',
        icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
      },
      {
        label: 'Pre-Stay',
        href: '/admin/pre-stay',
        icon: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
      },
      {
        label: 'Empfehlungsprogramm',
        href: '/admin/referrals',
        icon: icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
      },
      {
        label: 'Loyalität',
        href: '/admin/loyalty',
        icon: icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
      },
    ],
  },
  {
    title: 'Verkauf',
    items: [
      {
        label: 'Booking-Engine',
        href: '/admin/booking-engine',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
      {
        label: 'Best-Price',
        href: '/admin/best-price',
        icon: icon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      },
      {
        label: 'Booking-Recovery',
        href: '/admin/booking-recovery',
        icon: icon('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/>'),
      },
      {
        label: 'Self-Checkout',
        href: '/admin/self-checkout',
        icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
      },
    ],
  },
  {
    title: 'Integrationen',
    items: [
      {
        label: 'WhatsApp',
        href: '/admin/whatsapp',
        icon: icon('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
      },
      {
        label: 'Google My Business',
        sub: 'GMB · Bewertungen',
        href: '/admin/gmb',
        icon: icon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
      },
      {
        label: 'Wallet-Keys',
        href: '/admin/wallet-keys',
        icon: icon('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
      },
      {
        label: 'PMS',
        sub: 'Apaleo · Protel',
        href: '/admin/pms',
        icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
      },
      {
        label: 'E-Mail-Domain',
        href: '/admin/email-domain',
        icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
      },
    ],
  },
  {
    title: 'Einstellungen',
    items: [
      {
        label: 'Features',
        sub: 'Module an/aus',
        href: '/features',
        icon: icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
      },
      {
        label: 'Hotel-Einstellungen',
        sub: 'Name · Branding · Theme',
        href: '/admin/settings',
        icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
      },
      {
        label: 'Abonnement',
        href: '/admin/subscription',
        icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
      },
      {
        label: 'Team',
        sub: 'Mitglieder · Rollen',
        href: '/admin/team',
        icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
      },
      {
        label: 'Sicherheit & 2FA',
        sub: 'Team-Pflicht · MFA',
        href: '/admin/team-security',
        icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
      },
    ],
  },
];
