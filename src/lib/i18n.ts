export type Lang = 'de' | 'en' | 'fr' | 'es';
export const SUPPORTED_LANGS: Lang[] = ['de', 'en', 'fr', 'es'];

export function normalizeLang(input: string | undefined | null): Lang {
  if (!input) return 'de';
  const l = input.toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS.includes(l as Lang) ? l : 'de') as Lang;
}

export function pick<T extends Record<string, any>>(obj: T, field: string, lang: Lang): string {
  const direct = obj[`${field}_${lang}`];
  if (direct) return direct;
  return obj[`${field}_de`] || '';
}

export const UI_STRINGS = {
  de: {
    'hero.kicker': 'Willkommen zurück',
    'hero.greeting': 'Hallo',
    'hero.greetingFallback': 'Willkommen',
    'hero.stay.room': 'Zimmer',
    'hero.stay.departure': 'Abreise',
    'concierge.eyebrow': '— {name} empfiehlt heute —',
    'concierge.text.default': 'Schön, dich wieder bei uns zu haben.',
    'rec.eyebrow': '— Empfehlung für dich —',
    'actions.eyebrow': '— Was darf\'s sein —',
    'tile.wifi': 'WLAN', 'tile.wifi.sub': 'Gate-Guest · 320 Mbit/s',
    'tile.concierge': 'Concierge', 'tile.concierge.sub': 'online bis 22:00',
    'tile.breakfast': 'Frühstück', 'tile.breakfast.sub': '07:30–10:30 · im Wintergarten', 'tile.breakfast.badge': 'inkludiert',
    'tile.conference': 'Salon buchen', 'tile.conference.sub': 'Meetings & Besprechungen', 'tile.conference.badge': 'Premium',
    'tile.service': 'Service anfragen', 'tile.service.sub': 'Handtücher, Wasser, Hygiene & mehr', 'tile.service.badge': 'Schnell',
    'tile.berlin': 'Berliner Tipps', 'tile.berlin.sub': 'Charlottenburg & nebenan',
    'tile.checkout.label': 'Check-out', 'tile.checkout.sub': 'Sonntag bis 11:00',
    'footer.madeBy': 'made by',
    'time.morning': 'Morgen', 'time.midday': 'Mittag', 'time.afternoon': 'Nachmittag', 'time.evening': 'Abend', 'time.night': 'Nacht',
    'weather.sunny': 'sonnig', 'weather.partly': 'heiter', 'weather.cloudy': 'bewölkt', 'weather.rainy': 'Regen', 'weather.night': 'klar',
    'eve.placeholder': 'Frage {name} etwas …',
    'eve.typing': '{name} schreibt …',
    'eve.send': 'Senden',
    'eve.close': 'Schließen',
    'eve.confirm_booking': 'Bestätigen',
    'eve.cancel_booking': 'Abbrechen',
    'eve.confirmation_done': 'Erledigt — der Hotelier bekommt deine Anfrage gleich.',
    'eve.confirmation_cancelled': 'Kein Problem, sag Bescheid wenn ich helfen kann.',
    'eve.error_generic': '{name} ist gerade kurz nicht erreichbar — versuche es gleich nochmal.',
    'eve.chip_breakfast_when': 'Wann startet das Frühstück?',
    'eve.chip_wifi': 'WLAN-Passwort',
    'eve.chip_recommendations': 'Empfehlungen für heute',
    'eve.chip_checkout': 'Wann ist Check-out?',
    'eve.suggestions_label': '— Frag mich zum Beispiel —',
  },
  en: {
    'hero.kicker': 'Welcome back', 'hero.greeting': 'Hello', 'hero.greetingFallback': 'Welcome',
    'hero.stay.room': 'Room', 'hero.stay.departure': 'Departure',
    'concierge.eyebrow': '— {name} recommends today —', 'concierge.text.default': 'Glad to have you back.',
    'rec.eyebrow': '— Recommended for you —', 'actions.eyebrow': '— What can we get you —',
    'tile.wifi': 'Wi-Fi', 'tile.wifi.sub': 'Gate-Guest · 320 Mbit/s',
    'tile.concierge': 'Concierge', 'tile.concierge.sub': 'online until 22:00',
    'tile.breakfast': 'Breakfast', 'tile.breakfast.sub': '07:30–10:30 · in the conservatory', 'tile.breakfast.badge': 'included',
    'tile.conference': 'Book a salon', 'tile.conference.sub': 'Meetings & gatherings', 'tile.conference.badge': 'Premium',
    'tile.service': 'Request service', 'tile.service.sub': 'Towels, water, toiletries & more', 'tile.service.badge': 'Quick',
    'tile.berlin': 'Berlin tips', 'tile.berlin.sub': 'Charlottenburg & nearby',
    'tile.checkout.label': 'Check-out', 'tile.checkout.sub': 'Sunday by 11:00',
    'footer.madeBy': 'made by',
    'time.morning': 'Morning', 'time.midday': 'Midday', 'time.afternoon': 'Afternoon', 'time.evening': 'Evening', 'time.night': 'Night',
    'weather.sunny': 'sunny', 'weather.partly': 'fair', 'weather.cloudy': 'cloudy', 'weather.rainy': 'rainy', 'weather.night': 'clear',
    'eve.placeholder': 'Ask {name} anything …',
    'eve.typing': '{name} is typing …',
    'eve.send': 'Send',
    'eve.close': 'Close',
    'eve.confirm_booking': 'Confirm',
    'eve.cancel_booking': 'Cancel',
    'eve.confirmation_done': 'Done — your request is on its way to the hotel.',
    'eve.confirmation_cancelled': 'No problem, let me know if I can help.',
    'eve.error_generic': '{name} is briefly unreachable — please try again in a moment.',
    'eve.chip_breakfast_when': 'When does breakfast start?',
    'eve.chip_wifi': 'Wi-Fi password',
    'eve.chip_recommendations': 'Recommendations for today',
    'eve.chip_checkout': 'When is check-out?',
    'eve.suggestions_label': '— Ask me for example —',
  },
  fr: {
    'hero.kicker': 'Bon retour', 'hero.greeting': 'Bonjour', 'hero.greetingFallback': 'Bienvenue',
    'hero.stay.room': 'Chambre', 'hero.stay.departure': 'Départ',
    'concierge.eyebrow': '— {name} recommande aujourd\'hui —', 'concierge.text.default': 'Ravi de vous revoir.',
    'rec.eyebrow': '— Recommandé pour vous —', 'actions.eyebrow': '— Que désirez-vous —',
    'tile.wifi': 'Wi-Fi', 'tile.wifi.sub': 'Gate-Guest · 320 Mbit/s',
    'tile.concierge': 'Conciergerie', 'tile.concierge.sub': 'jusqu\'à 22h',
    'tile.breakfast': 'Petit-déjeuner', 'tile.breakfast.sub': '07h30–10h30 · au jardin d\'hiver', 'tile.breakfast.badge': 'inclus',
    'tile.conference': 'Réserver salon', 'tile.conference.sub': 'Réunions & rencontres', 'tile.conference.badge': 'Premium',
    'tile.service': 'Demander un service', 'tile.service.sub': 'Serviettes, eau, hygiène & plus', 'tile.service.badge': 'Rapide',
    'tile.berlin': 'Conseils Berlin', 'tile.berlin.sub': 'Charlottenburg & alentours',
    'tile.checkout.label': 'Départ', 'tile.checkout.sub': 'Dimanche avant 11h',
    'footer.madeBy': 'fabriqué par',
    'time.morning': 'Matin', 'time.midday': 'Midi', 'time.afternoon': 'Après-midi', 'time.evening': 'Soir', 'time.night': 'Nuit',
    'weather.sunny': 'ensoleillé', 'weather.partly': 'éclaircies', 'weather.cloudy': 'nuageux', 'weather.rainy': 'pluvieux', 'weather.night': 'clair',
    'eve.placeholder': 'Demandez à {name} …',
    'eve.typing': '{name} écrit …',
    'eve.send': 'Envoyer',
    'eve.close': 'Fermer',
    'eve.confirm_booking': 'Confirmer',
    'eve.cancel_booking': 'Annuler',
    'eve.confirmation_done': 'C\'est fait — votre demande arrive à la réception.',
    'eve.confirmation_cancelled': 'Pas de souci, dites-moi si je peux aider.',
    'eve.error_generic': '{name} est momentanément indisponible — réessayez dans un instant.',
    'eve.chip_breakfast_when': 'Quand commence le petit-déjeuner ?',
    'eve.chip_wifi': 'Mot de passe Wi-Fi',
    'eve.chip_recommendations': 'Recommandations pour aujourd\'hui',
    'eve.chip_checkout': 'À quelle heure le départ ?',
    'eve.suggestions_label': '— Par exemple —',
  },
  es: {
    'hero.kicker': 'Bienvenida de nuevo', 'hero.greeting': 'Hola', 'hero.greetingFallback': 'Bienvenida',
    'hero.stay.room': 'Habitación', 'hero.stay.departure': 'Salida',
    'concierge.eyebrow': '— {name} recomienda hoy —', 'concierge.text.default': 'Encantada de tenerte de vuelta.',
    'rec.eyebrow': '— Recomendado para ti —', 'actions.eyebrow': '— ¿En qué podemos ayudar? —',
    'tile.wifi': 'Wi-Fi', 'tile.wifi.sub': 'Gate-Guest · 320 Mbit/s',
    'tile.concierge': 'Conserjería', 'tile.concierge.sub': 'hasta las 22:00',
    'tile.breakfast': 'Desayuno', 'tile.breakfast.sub': '07:30–10:30 · en el jardín de invierno', 'tile.breakfast.badge': 'incluido',
    'tile.conference': 'Reservar salón', 'tile.conference.sub': 'Reuniones y encuentros', 'tile.conference.badge': 'Premium',
    'tile.service': 'Solicitar servicio', 'tile.service.sub': 'Toallas, agua, higiene y más', 'tile.service.badge': 'Rápido',
    'tile.berlin': 'Consejos Berlín', 'tile.berlin.sub': 'Charlottenburg y alrededores',
    'tile.checkout.label': 'Salida', 'tile.checkout.sub': 'Domingo hasta las 11:00',
    'footer.madeBy': 'hecho por',
    'time.morning': 'Mañana', 'time.midday': 'Mediodía', 'time.afternoon': 'Tarde', 'time.evening': 'Noche', 'time.night': 'Madrugada',
    'weather.sunny': 'soleado', 'weather.partly': 'parcialmente nublado', 'weather.cloudy': 'nublado', 'weather.rainy': 'lluvioso', 'weather.night': 'despejado',
    'eve.placeholder': 'Pregúntale a {name} …',
    'eve.typing': '{name} está escribiendo …',
    'eve.send': 'Enviar',
    'eve.close': 'Cerrar',
    'eve.confirm_booking': 'Confirmar',
    'eve.cancel_booking': 'Cancelar',
    'eve.confirmation_done': 'Listo — tu solicitud está en camino a recepción.',
    'eve.confirmation_cancelled': 'Sin problema, dime si puedo ayudar.',
    'eve.error_generic': '{name} no está disponible ahora — intenta de nuevo en un momento.',
    'eve.chip_breakfast_when': '¿Cuándo empieza el desayuno?',
    'eve.chip_wifi': 'Contraseña Wi-Fi',
    'eve.chip_recommendations': 'Recomendaciones para hoy',
    'eve.chip_checkout': '¿A qué hora es la salida?',
    'eve.suggestions_label': '— Por ejemplo —',
  },
} as const;

export type UIKey = keyof typeof UI_STRINGS['de'];

export function t(key: UIKey, lang: Lang): string {
  return (UI_STRINGS[lang]?.[key] || UI_STRINGS.de[key] || key) as string;
}

export function dayPart(lang: Lang, hour: number): string {
  if (hour >= 5 && hour < 10) return t('time.morning', lang);
  if (hour >= 10 && hour < 14) return t('time.midday', lang);
  if (hour >= 14 && hour < 18) return t('time.afternoon', lang);
  if (hour >= 18 && hour < 23) return t('time.evening', lang);
  return t('time.night', lang);
}
