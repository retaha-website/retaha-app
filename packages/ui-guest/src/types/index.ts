export interface GuestTheme {
  /** Brand-Primärfarbe (hex) — wird als --theme-accent gesetzt */
  primary: string;
  secondary?: string;
  /** Entspricht hotels.brand_theme (coffee/ocean/forest/custom) */
  themeName: 'coffee' | 'ocean' | 'forest' | 'custom';
  /** Gemappter Gäste-App Theme-Name */
  guestThemeName: 'bauhaus_manufaktur' | 'premium_anthrazit' | 'warmes_burgund';
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
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

/** Mappt Backoffice-Brand-Theme zu Gäste-App-Theme-Namen */
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
