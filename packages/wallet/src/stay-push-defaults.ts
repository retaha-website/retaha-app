// Sprint Wallet · Stay-Push Default-Texte (DE, Source-of-Truth)
//
// Werden als Platzhalter im Backoffice-Editor angezeigt wenn noch kein
// Hotel-spezifischer Text gespeichert wurde. Der Hotelier sieht die Defaults
// sofort und kann sie übernehmen oder anpassen. Erst beim Speichern wird
// übersetzt (Haiku via mergeAndTranslateMarketing).
//
// Variablen: Doppelte geschweifte Klammern {{variable_name}}.

export const STAY_PUSH_DEFAULTS: Record<string, { title: string; body: string }> = {
  welcome: {
    title: 'Willkommen im {{hotel_name}}',
    body:  'Schön, dass Sie da sind, {{first_name}}. Alles rund um Ihren Aufenthalt finden Sie ab jetzt hier.',
  },
  room_ready: {
    title: 'Ihr Zimmer ist bereit',
    body:  'Zimmer {{room_number}} ist fertig, {{first_name}} — Sie können einchecken.',
  },
  housekeeping_done: {
    title: 'Ihr Zimmer ist frisch gemacht',
    body:  'Zimmer {{room_number}} wurde gerade für Sie hergerichtet.',
  },
  service_confirmed: {
    title: 'Bestätigt',
    body:  'Ihre Anfrage ist bestätigt, {{first_name}}. Wir kümmern uns darum.',
  },
  service_declined: {
    title: 'Leider nicht möglich',
    body:  'Ihre Anfrage konnten wir diesmal nicht bestätigen. Sprechen Sie uns gern an der Rezeption an.',
  },
  restaurant_reservation: {
    title: 'Tisch reserviert',
    body:  'Ihre Reservierung steht, {{first_name}}. Wir freuen uns auf Sie.',
  },
  spa_reservation: {
    title: 'Spa gebucht',
    body:  'Ihr Termin ist reserviert, {{first_name}}. Zeit zum Entspannen.',
  },
  late_checkout_approved: {
    title: 'Später Check-out bestätigt',
    body:  'Sie können bis {{checkout_time}} bleiben, {{first_name}}. Lassen Sie sich Zeit.',
  },
  checkout_reminder: {
    title: 'Check-out um {{checkout_time}}',
    body:  'Ihr Check-out ist um {{checkout_time}}, {{first_name}}. Brauchen Sie länger? Wir finden eine Lösung.',
  },
};
