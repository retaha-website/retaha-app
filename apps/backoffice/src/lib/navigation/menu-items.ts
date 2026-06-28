import { bt, type LanguageCode } from '@retaha/i18n';

export interface MenuItem {
  label: string;
  sub?: string;
  href: string;
  icon: string;
  /** Plan required to access this item. undefined = accessible to all plans. */
  requiredPlan?: 'pro' | 'premium';
  /** Module key for /freischalten/[moduleKey] preview page. */
  moduleKey?: string;
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

// Labels/Subs/Titel über bt(key, lang). DE = Source in packages/i18n/backoffice-strings.ts,
// restliche Sprachen via Translate-Script.
export function getMenuSections(lang: LanguageCode): MenuSection[] {
  return [
    {
      title: bt('nav.sec.overview', lang),
      items: [
        {
          label: bt('nav.dashboard', lang),
          sub: bt('nav.dashboard.sub', lang),
          href: '/overview',
          icon: icon('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.marketing', lang),
      items: [
        {
          label: bt('nav.marketing', lang),
          sub: bt('nav.marketing.sub', lang),
          href: '/marketing',
          requiredPlan: 'premium',
          moduleKey: 'marketing',
          icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
        },
        {
          label: bt('nav.guests', lang),
          sub: bt('nav.guests.sub', lang),
          href: '/marketing/guests',
          requiredPlan: 'premium',
          moduleKey: 'marketing',
          icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
        },
        {
          label: bt('nav.emaildomain', lang),
          sub: bt('nav.emaildomain.sub', lang),
          href: '/email-domain',
          requiredPlan: 'premium',
          moduleKey: 'email-domain',
          icon: icon('<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z"/><path d="M22 10l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.guestmodules', lang),
      items: [
        {
          label: bt('nav.breakfast', lang),
          sub: bt('nav.breakfast.sub', lang),
          href: '/breakfast',
          icon: icon('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
        },
        {
          label: bt('nav.eve', lang),
          sub: bt('nav.eve.sub', lang),
          href: '/eve/knowledge',
          icon: icon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>'),
        },
        {
          label: bt('nav.service', lang),
          sub: bt('nav.service.sub', lang),
          href: '/service-items',
          icon: icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
        },
        {
          label: bt('nav.places', lang),
          sub: bt('nav.places.sub', lang),
          href: '/places',
          requiredPlan: 'pro',
          moduleKey: 'empfehlungen',
          icon: icon('<circle cx="12" cy="11" r="3"/><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>'),
        },
        {
          label: bt('nav.checkout', lang),
          sub: bt('nav.checkout.sub', lang),
          href: '/self-checkout',
          icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
        },
        {
          label: bt('nav.wallet', lang),
          sub: bt('nav.wallet.sub', lang),
          href: '/wallet-keys',
          requiredPlan: 'premium',
          moduleKey: 'wallet',
          icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
        },
        {
          label: bt('nav.loyalty', lang),
          sub: bt('nav.loyalty.sub', lang),
          href: `${GUEST_APP}/loyalty`,
          requiredPlan: 'premium',
          moduleKey: 'loyalty',
          icon: icon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
        },
        {
          label: bt('nav.herocards', lang),
          sub: bt('nav.herocards.sub', lang),
          href: '/admin/action-cards',
          icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
        },
        {
          label: bt('nav.branding', lang),
          sub: bt('nav.branding.sub', lang),
          href: '/branding',
          icon: icon('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="m8 12 2 2 4-4"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.tools', lang),
      items: [
        {
          label: bt('nav.staypushes', lang),
          sub: bt('nav.staypushes.sub', lang),
          href: '/stay-pushes',
          requiredPlan: 'premium',
          moduleKey: 'stay-push',
          icon: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
        },
        {
          label: bt('nav.nfc', lang),
          sub: bt('nav.nfc.sub', lang),
          href: '/nfc-tags',
          requiredPlan: 'pro',
          moduleKey: 'nfc-tags',
          icon: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.hotel', lang),
      items: [
        {
          label: bt('nav.general', lang),
          sub: bt('nav.general.sub', lang),
          href: '/admin/settings',
          icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
        },
        {
          label: bt('nav.team', lang),
          sub: bt('nav.team.sub', lang),
          href: '/team',
          icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
        },
        {
          label: bt('nav.security', lang),
          sub: bt('nav.security.sub', lang),
          href: '/profil/sicherheit',
          icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.billing', lang),
      items: [
        {
          label: bt('nav.subscription', lang),
          sub: bt('nav.subscription.sub', lang),
          href: '/subscription',
          icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.integrations', lang),
      items: [
        {
          label: bt('nav.pms', lang),
          sub: bt('nav.pms.sub', lang),
          href: '/pms',
          requiredPlan: 'premium',
          moduleKey: 'pms',
          icon: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
        },
        {
          label: bt('nav.bookingengine', lang),
          sub: bt('nav.bookingengine.sub', lang),
          href: '/booking-engine',
          requiredPlan: 'premium',
          moduleKey: 'booking-engine',
          icon: icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
        },
        {
          label: bt('nav.bestprice', lang),
          sub: bt('nav.bestprice.sub', lang),
          href: '/best-price',
          requiredPlan: 'premium',
          moduleKey: 'best-price',
          icon: icon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
        },
        {
          label: bt('nav.bookingrecovery', lang),
          sub: bt('nav.bookingrecovery.sub', lang),
          href: '/booking-recovery',
          requiredPlan: 'premium',
          moduleKey: 'booking-recovery',
          icon: icon('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/>'),
        },
        {
          label: bt('nav.checkout2', lang),
          sub: bt('nav.checkout2.sub', lang),
          href: '/self-checkout',
          icon: icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
        },
      ],
    },
    {
      title: bt('nav.sec.legal', lang),
      items: [
        {
          label: bt('nav.agb', lang),
          href: '/agb',
          icon: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
        },
        {
          label: bt('nav.privacy', lang),
          href: '/datenschutz',
          icon: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
        },
        {
          label: bt('nav.imprint', lang),
          href: '/impressum',
          icon: icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
        },
      ],
    },
    // „Konto" (Mein Profil + Abmelden) lebt ausschließlich im Account-Icon-Dropdown
    // (UserDropdown) — nicht doppelt im Key-/Burger-Menü.
  ];
}
