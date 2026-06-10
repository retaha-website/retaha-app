export type StayMode = 'pre_arrival' | 'in_house' | 'checking_out';
export type ModuleKey = 'wifi' | 'breakfast' | 'eve' | 'service' | 'places' | 'conference' | 'checkout' | 'wallet';

export function getStayMode(stay: { check_in: string; check_out: string; status?: string }): StayMode {
  // Mews-Status zuerst (falls vorhanden)
  const s = (stay.status ?? '').toLowerCase();
  if (s === 'expected' || s === 'pre_arrival') return 'pre_arrival';

  // Datum-basierter Fallback (zuverlässig für alle Token-Typen)
  if (Date.parse(stay.check_in) > Date.now()) return 'pre_arrival';
  if (new Date(stay.check_out).toDateString() === new Date().toDateString()) return 'checking_out';
  return 'in_house';
}

// Reihenfolge ist gleichzeitig Priorität in der Action-Liste
const MODULE_ORDER: Record<StayMode, ModuleKey[]> = {
  pre_arrival:  ['wifi', 'breakfast', 'eve', 'places', 'wallet'],
  in_house:     ['wifi', 'breakfast', 'eve', 'service', 'places', 'conference', 'checkout', 'wallet'],
  checking_out: ['checkout', 'eve', 'wallet', 'breakfast', 'places'],
};

export function getVisibleModules(mode: StayMode): ModuleKey[] {
  return MODULE_ORDER[mode];
}

// i18n-Texte pro Mode für Begrüßung + Subzeile
type Lang = 'de' | 'en' | 'fr' | 'es';
export const MODE_GREETING: Record<StayMode, Record<Lang, { hi: string; sub: string }>> = {
  pre_arrival: {
    de: { hi: 'Willkommen,', sub: 'Wir freuen uns auf deinen Besuch.' },
    en: { hi: 'Welcome,',    sub: 'We look forward to your stay.' },
    fr: { hi: 'Bienvenue,',  sub: 'Nous avons hâte de vous accueillir.' },
    es: { hi: 'Bienvenido,', sub: 'Esperamos con entusiasmo su visita.' },
  },
  in_house: {
    de: { hi: 'Hallo,',     sub: '' }, // sub kommt aus hotel.welcome_message_de
    en: { hi: 'Hello,',     sub: '' },
    fr: { hi: 'Bonjour,',   sub: '' },
    es: { hi: 'Hola,',      sub: '' },
  },
  checking_out: {
    de: { hi: 'Schön, dass du da warst,', sub: 'Vielen Dank für deinen Aufenthalt.' },
    en: { hi: 'Goodbye,',                  sub: 'Thank you for staying with us.' },
    fr: { hi: 'Au revoir,',                sub: 'Merci pour votre séjour.' },
    es: { hi: 'Hasta pronto,',             sub: 'Gracias por su estancia.' },
  },
};
