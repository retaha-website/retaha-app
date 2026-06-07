export interface GuestTheme {
  /** Brand-Primärfarbe (hex) — wird als --theme-accent gesetzt */
  primary: string;
  secondary?: string;
  /** Entspricht hotels.brand_theme (coffee/ocean/forest/custom) — legacy */
  themeName: 'coffee' | 'ocean' | 'forest' | 'custom';
  /** Gemappter Gäste-App Theme-Name — legacy, für retaha.css */
  guestThemeName: 'bauhaus_manufaktur' | 'premium_anthrazit' | 'warmes_burgund';
  /** Neue Design-Identität — bestimmt data-theme auf GuestPhoneView */
  designIdentity?: 'classic' | 'bauhaus' | 'editorial' | 'maison';
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  heroBackground?: string | null;
  hotelName: string;
  eveName?: string;
}

export interface GuestActionCard {
  eyebrow?: string;
  title: string;
  sub?: string;
  cta: string;
  cardClass?: 'rec-anthrazit' | 'rec-pink' | 'rec-white';
}

export interface GuestRecommendation {
  name: string;
  category: string;
  distance?: string;
  rating?: number;
  isHotelierPick?: boolean;
}

export interface GuestEveMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GuestServiceTile {
  icon: string;
  label: string;
  sub: string;
  badge?: string;
  badgeClass?: 'green' | 'burgund' | 'orange';
}

/** Mappt Backoffice-Brand-Theme zu Gäste-App-Theme-Namen (legacy) */
export function mapThemeName(
  brandTheme: string,
): 'bauhaus_manufaktur' | 'premium_anthrazit' | 'warmes_burgund' {
  switch (brandTheme) {
    case 'ocean':   return 'premium_anthrazit';
    case 'forest':  return 'warmes_burgund';
    case 'coffee':
    default:        return 'bauhaus_manufaktur';
  }
}

/** Mappt Design-Identität zu data-theme für GuestPhoneView */
export function resolveDataTheme(
  designIdentity: string | undefined | null,
  guestThemeName: string,
): string {
  if (designIdentity === 'classic' || designIdentity === 'bauhaus' || designIdentity === 'editorial' || designIdentity === 'maison') {
    return designIdentity;
  }
  return guestThemeName; // legacy fallback
}
