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
  it: ['Password Wi-Fi', 'Quando è il checkout?'],
  pt: ['Senha de WiFi', 'Quando é o check-out?'],
  nl: ['WiFi-wachtwoord', 'Wanneer is het vertrek?'],
  ru: ['Пароль Wi-Fi', 'Когда выезд?'],
  ar: ['كلمة مرور Wi-Fi', 'متى موعد المغادرة؟'],
  zh: ['WiFi密码', '退房时间?'],
};

// Chip-Texte für modul-gesteuerte Smart-Chips (10 Sprachen)
const MODULE_WIFI: Record<Lang, string> = {
  de: 'WLAN-Passwort', en: 'Wi-Fi password', fr: 'Mot de passe Wi-Fi', es: 'Contraseña Wi-Fi',
  it: 'Password Wi-Fi', pt: 'Senha de WiFi', nl: 'WiFi-wachtwoord',
  ru: 'Пароль Wi-Fi', ar: 'كلمة مرور Wi-Fi', zh: 'WiFi密码',
};
const MODULE_BREAKFAST: Record<Lang, string> = {
  de: 'Wann startet das Frühstück?', en: 'When does breakfast start?',
  fr: 'Quand commence le petit-déjeuner ?', es: '¿Cuándo empieza el desayuno?',
  it: 'Quando inizia la colazione?', pt: 'Quando começa o café da manhã?',
  nl: 'Wanneer begint het ontbijt?', ru: 'Когда начинается завтрак?',
  ar: 'متى يبدأ الإفطار؟', zh: '早餐几点开始?',
};
const MODULE_CHECKOUT: Record<Lang, string> = {
  de: 'Wann ist Check-out?', en: 'When is check-out?',
  fr: 'À quelle heure le départ ?', es: '¿A qué hora la salida?',
  it: 'Quando è il checkout?', pt: 'Quando é o check-out?',
  nl: 'Wanneer is het vertrek?', ru: 'Когда выезд?',
  ar: 'متى موعد المغادرة؟', zh: '退房时间?',
};

/**
 * Returns 4-5 suggestion chips based on hour of day + language.
 * Legacy function kept for backward compatibility.
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

/**
 * Smart chips: FAQ-Fragen (top 2) → Modul-Chips (wifi/breakfast wenn aktiv) →
 * Checkout → Tageszeit-Filler. Max 5, dedup by text. Alle 10 Sprachen.
 */
export function getEveSmartChips(
  hour: number,
  lang: Lang,
  faqEntries: Array<{ id: string; question: string; question_i18n?: unknown }>,
  modules: { wifi: boolean; breakfast: boolean },
): SuggestionChip[] {
  const chips: SuggestionChip[] = [];
  const seen = new Set<string>();

  const push = (chip: SuggestionChip) => {
    if (chips.length >= 5 || seen.has(chip.text)) return;
    chips.push(chip);
    seen.add(chip.text);
  };

  // 1. Top 2 FAQ-Chips in Gast-Sprache
  for (const faq of faqEntries.slice(0, 2)) {
    const i18n = faq.question_i18n as Record<string, { value?: string }> | null | undefined;
    const text = i18n?.[lang]?.value || i18n?.['en']?.value || i18n?.['de']?.value || faq.question;
    if (text?.trim()) push({ key: `faq_${faq.id}`, text: text.trim() });
  }

  // 2. Modul-Chips — nur wenn Modul aktiv
  if (modules.wifi)      push({ key: 'chip_wifi',      text: MODULE_WIFI[lang]      ?? MODULE_WIFI.de });
  if (modules.breakfast) push({ key: 'chip_breakfast', text: MODULE_BREAKFAST[lang] ?? MODULE_BREAKFAST.de });

  // 3. Check-out immer nützlich
  push({ key: 'chip_checkout', text: MODULE_CHECKOUT[lang] ?? MODULE_CHECKOUT.de });

  // 4. Tageszeit-Filler (kein Universal mehr — oben bereits gehandhabt)
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  let dayPart: ChipSet;
  let pfx: string;
  if (h >= 6 && h < 11)       { dayPart = MORNING; pfx = 'morning'; }
  else if (h >= 11 && h < 15) { dayPart = MIDDAY;  pfx = 'midday'; }
  else if (h >= 15 && h < 22) { dayPart = EVENING; pfx = 'evening'; }
  else                         { dayPart = NIGHT;   pfx = 'night'; }
  (dayPart[lang] ?? dayPart.de).forEach((text, i) => push({ key: `${pfx}_${i}`, text }));

  return chips;
}
