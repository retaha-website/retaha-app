// Sprint E4 · Phase 10 — Tageszeit-abhängige Suggestion-Chips
//
// 4 Sets pro Sprache (morning / midday / evening / night), plus 2
// universelle Chips die immer dabei sind (WLAN, Check-out).

import type { Lang } from './lang';

export interface SuggestionChip {
  key: string;
  text: string;
}

type ChipSet = Record<Lang, string[]>;

const MORNING: ChipSet = {
  de: ['Wann startet das Frühstück?', 'Wetter heute?', 'Was kann ich heute machen?'],
  en: ['When does breakfast start?', 'Weather today?', 'What can I do today?'],
  fr: ['Quand commence le petit-déjeuner ?', 'Météo aujourd\'hui ?', 'Que faire aujourd\'hui ?'],
  es: ['¿Cuándo empieza el desayuno?', '¿Tiempo de hoy?', '¿Qué hacer hoy?'],
};

const MIDDAY: ChipSet = {
  de: ['Wo gibt\'s gutes Mittagessen?', 'Lokale Tipps in der Nähe', 'Wie komme ich ins Zentrum?'],
  en: ['Where for lunch?', 'Local tips nearby', 'How do I get to the center?'],
  fr: ['Où déjeuner ?', 'Bonnes adresses dans le coin', 'Comment aller au centre ?'],
  es: ['¿Dónde comer al mediodía?', 'Sugerencias locales', '¿Cómo llego al centro?'],
};

const EVENING: ChipSet = {
  de: ['Restaurant-Empfehlung für heute Abend?', 'Bar-Tipp in der Nähe', 'Was ist los in der Gegend?'],
  en: ['Restaurant for tonight?', 'Bar nearby', 'What\'s happening around here?'],
  fr: ['Restaurant pour ce soir ?', 'Un bon bar à proximité', 'Que se passe-t-il dans le coin ?'],
  es: ['¿Restaurante para esta noche?', 'Un bar cerca', '¿Qué hay por aquí?'],
};

const NIGHT: ChipSet = {
  de: ['Notfall-Kontakt', 'Frühstück morgen früh', 'Brauche ich einen Schlüssel zur Tür?'],
  en: ['Emergency contact', 'Breakfast tomorrow', 'Do I need a key for the door?'],
  fr: ['Contact d\'urgence', 'Petit-déjeuner demain', 'Faut-il une clé pour la porte ?'],
  es: ['Contacto de emergencia', 'Desayuno mañana', '¿Necesito llave para la puerta?'],
};

const UNIVERSAL: ChipSet = {
  de: ['WLAN-Passwort', 'Wann ist Check-out?'],
  en: ['Wi-Fi password', 'When is check-out?'],
  fr: ['Mot de passe Wi-Fi', 'À quelle heure le départ ?'],
  es: ['Contraseña Wi-Fi', '¿A qué hora la salida?'],
};

/**
 * Returns 4-5 suggestion chips based on hour of day + language.
 *
 * Morning: 06:00–11:00 — Frühstück, Wetter, Tages-Aktivitäten
 * Midday:  11:00–15:00 — Mittagessen, lokale Tipps
 * Evening: 15:00–22:00 — Abend-Restaurant, Bar, Events
 * Night:   22:00–06:00 — Notfall, Morgen-Vorausplanung
 *
 * Plus 2 universelle Chips am Ende: WLAN + Check-out.
 *
 * Fallback bei unklarer Hour: Morning-Set.
 */
export function getEveSuggestions(hour: number, lang: Lang): SuggestionChip[] {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  let dayPart: ChipSet;
  let prefix: string;

  if (h >= 6 && h < 11)       { dayPart = MORNING; prefix = 'morning'; }
  else if (h >= 11 && h < 15) { dayPart = MIDDAY;  prefix = 'midday'; }
  else if (h >= 15 && h < 22) { dayPart = EVENING; prefix = 'evening'; }
  else                         { dayPart = NIGHT;   prefix = 'night'; }

  const main = (dayPart[lang] ?? dayPart.de).map((text, i) => ({ key: `${prefix}_${i}`, text }));
  const universal = (UNIVERSAL[lang] ?? UNIVERSAL.de).map((text, i) => ({ key: `universal_${i}`, text }));
  return [...main, ...universal];
}
