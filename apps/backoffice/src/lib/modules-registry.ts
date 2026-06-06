export type ModuleTier = 'lite' | 'pro' | 'premium' | 'enterprise';

export interface ModuleDefinition {
  key: string;
  label: string;
  desc: string;
  tier: ModuleTier;
  required?: boolean;
  comingSoon?: boolean;
  beta?: boolean;
  requiresHardware?: boolean;
  addonPrice?: string;
  addonForTiers?: ModuleTier[];
  linkedRoute?: string;
  legacyKey?: string;
  icon: string;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ── LITE — Pflicht ────────────────────────────────────────────────────────
  {
    key: 'welcome',
    label: 'Willkommens-Hub',
    desc: 'Hero-Seite mit Hotel-Logo, Zimmernummer und Aufenthaltsdaten.',
    tier: 'lite',
    required: true,
    linkedRoute: '/admin/settings',
    icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  },
  {
    key: 'wifi',
    label: 'WLAN',
    desc: 'WLAN-Name und Passwort mit QR-Code — sofort kopierbar.',
    tier: 'lite',
    required: true,
    linkedRoute: '/admin/settings',
    icon: `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>`,
  },
  {
    key: 'breakfast',
    label: 'Frühstück',
    desc: 'Gäste reservieren Frühstücks-Slots direkt in der App.',
    tier: 'lite',
    legacyKey: 'breakfast_enabled',
    linkedRoute: '/admin/breakfast',
    icon: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
  },
  {
    key: 'conference',
    label: 'Konferenz',
    desc: 'Konferenzraum-Buchung mit Zeitfenster und Bestätigung.',
    tier: 'lite',
    legacyKey: 'conference_enabled',
    linkedRoute: '/admin/conference',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    key: 'service',
    label: 'Service-Anfragen',
    desc: 'Handtücher, Zimmerservice, Wasser — per Tap, ohne Anruf.',
    tier: 'lite',
    legacyKey: 'service_enabled',
    linkedRoute: '/admin/service',
    icon: `<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>`,
  },
  {
    key: 'feedback',
    label: 'Post-Stay Feedback',
    desc: 'Kurzes Rating nach Checkout — intern, bevor Google gefragt wird.',
    tier: 'lite',
    linkedRoute: '/admin/feedback',
    icon: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  },

  // ── PRO — inkludiert ──────────────────────────────────────────────────────
  {
    key: 'action_cards',
    label: 'Action-Cards',
    desc: 'Bis zu 5 Hero-Kacheln: Links, Infos, Telefon, Email, interne Aktionen.',
    tier: 'pro',
    linkedRoute: '/admin/action-cards',
    icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
  },
  {
    key: 'recommendations',
    label: 'Empfehlungen',
    desc: 'Kuratierte Restaurants, Cafés, Bars — mit Google-Places-Daten.',
    tier: 'pro',
    linkedRoute: '/admin/places',
    icon: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
  },
  {
    key: 'wallet',
    label: 'Wallet-Pass + CRM',
    desc: 'Google Wallet-Karte für Stammgäste — mit Wiederkehrer-Tracking.',
    tier: 'pro',
    legacyKey: 'wallet_enabled',
    linkedRoute: '/admin/wallet',
    icon: `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
  },
  {
    key: 'marketing',
    label: 'Marketing (Drips + Kampagnen)',
    desc: 'Automatische Email-Sequenzen und manuelle Kampagnen an Wallet-Gäste.',
    tier: 'pro',
    legacyKey: 'marketing_enabled',
    linkedRoute: '/admin/marketing',
    icon: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  },
  {
    key: 'stay_pushes',
    label: '9 Stay-Push-Trigger',
    desc: 'Automatische Push-Notifications bei Ankuft, Checkout, Buchungen u.m.',
    tier: 'pro',
    linkedRoute: '/admin/stay-pushes',
    icon: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  },
  {
    key: 'multi_language',
    label: '10 Sprachen Auto',
    desc: 'Gäste wählen ihre Sprache — Inhalte werden automatisch übersetzt.',
    tier: 'pro',
    linkedRoute: '/admin/settings',
    icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  },
  {
    key: 'pre_stay',
    label: 'Pre-Stay Messaging',
    desc: 'Automatische Email X Tage vor Ankunft — mit Check-In-Link.',
    tier: 'pro',
    legacyKey: 'pre_stay_enabled',
    linkedRoute: '/admin/pre-stay',
    icon: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  },
  {
    key: 'self_checkout',
    label: 'Self-Checkout',
    desc: 'Gäste checken aus ohne Empfangs-Schlange — digital, schnell.',
    tier: 'pro',
    legacyKey: 'self_checkout_enabled',
    linkedRoute: '/admin/self-checkout',
    icon: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  },
  {
    key: 'nfc_tags',
    label: 'NFC-Tag Management',
    desc: 'Holz-NFC-Karten für Zimmerzugang — direkt aus dem Shop bestellbar.',
    tier: 'pro',
    requiresHardware: true,
    linkedRoute: '/admin/nfc-tags',
    icon: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  },
  {
    key: 'custom_email_domain',
    label: 'Custom Email-Domain',
    desc: 'Emails kommen von @deinehotel.de statt @retaha.de.',
    tier: 'pro',
    linkedRoute: '/admin/email-domain',
    icon: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  },
  {
    key: 'showcase',
    label: 'Showcase Demo-Sessions',
    desc: 'Demo-Links für Vertrieb und Präsentationen ohne echten Gast-Account.',
    tier: 'pro',
    linkedRoute: '/admin/showcase',
    icon: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  },
  {
    key: 'loyalty',
    label: 'Loyalty-Program',
    desc: 'Punkte, Stufen und Belohnungen für Stammgäste.',
    tier: 'pro',
    beta: true,
    linkedRoute: '/admin/loyalty',
    icon: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>`,
  },

  // ── PREMIUM — Eve als Add-On im LITE/PRO ─────────────────────────────────
  {
    key: 'eve',
    label: 'Eve KI-Concierge',
    desc: 'KI-Assistent für Gäste: Fragen, Buchungen, Empfehlungen — 24/7.',
    tier: 'premium',
    legacyKey: 'eve_enabled',
    addonPrice: '89€/Monat',
    addonForTiers: ['lite', 'pro'],
    linkedRoute: '/admin/eve/settings',
    icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  },

  // ── PREMIUM — Coming Soon ─────────────────────────────────────────────────
  {
    key: 'spa',
    label: 'Spa & Wellness',
    desc: 'Spa-Treatments, Massagen und Wellness direkt buchbar.',
    tier: 'premium',
    comingSoon: true,
    icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  },
  {
    key: 'restaurant',
    label: 'Restaurant-Reservierungen',
    desc: 'Tisch reservieren, Menü einsehen, Bestellung vorbestellen.',
    tier: 'premium',
    comingSoon: true,
    icon: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="11"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Business',
    desc: 'Gäste chatten via WhatsApp — Eve antwortet auch dort.',
    tier: 'premium',
    comingSoon: true,
    icon: `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`,
  },
  {
    key: 'microsite',
    label: 'Microsite-Builder',
    desc: 'Eigene Hotel-Landingpage ohne Agentur — SEO-ready.',
    tier: 'premium',
    comingSoon: true,
    icon: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>`,
  },
  {
    key: 'best_price',
    label: 'Best-Price-Guarantee',
    desc: 'Gäste buchen direkt — mit Preisgarantie gegenüber OTAs.',
    tier: 'premium',
    comingSoon: true,
    icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  },
  {
    key: 'referrals',
    label: 'Referral-Program',
    desc: 'Gäste empfehlen das Hotel und verdienen Prämien.',
    tier: 'premium',
    comingSoon: true,
    icon: `<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  },

  // ── ENTERPRISE ────────────────────────────────────────────────────────────
  {
    key: 'multi_property',
    label: 'Multi-Property',
    desc: 'Mehrere Hotels unter einem Dashboard — zentrales Management.',
    tier: 'enterprise',
    comingSoon: true,
    icon: `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
  },
  {
    key: 'white_label',
    label: 'White-Label',
    desc: 'Vollständig gebrandete App ohne retaha-Branding.',
    tier: 'enterprise',
    comingSoon: true,
    icon: `<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>`,
  },
  {
    key: 'api_access',
    label: 'API-Zugang',
    desc: 'Direkter API-Zugriff für eigene Integrationen und Entwickler.',
    tier: 'enterprise',
    comingSoon: true,
    icon: `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,
  },
];

export const TIER_LABELS: Record<ModuleTier, string> = {
  lite: 'Lite',
  pro: 'Pro',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const TIER_COLORS: Record<ModuleTier, string> = {
  lite: '#4A8C4A',
  pro: '#2563EB',
  premium: '#7C3AED',
  enterprise: '#1F1812',
};
