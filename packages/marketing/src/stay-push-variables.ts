// Sprint Wallet · Modul D — Stay-Push Variable-Validation
//
// Stay-Pushes erlauben MEHR Variablen als Marketing-Templates (Stay-Context).
// Pro Trigger-Typ definieren wir welche Variablen sinnvoll sind — die UI
// zeigt dem Hotelier nur die passenden Insert-Buttons.

import { STAY_PUSH_ALLOWED_VARIABLES, SERVER_ONLY_VARIABLES, HOTELIER_ALLOWED_VARIABLES } from './variables';
import type { HotelierVariable } from './variables';

export type StayPushVariable = typeof STAY_PUSH_ALLOWED_VARIABLES[number];

export interface StayPushValidationResult {
  ok: boolean;
  unknown: string[];
  forbidden: string[];   // Server-only Variablen (z.B. {{unsubscribe_link}}) sind hier auch verboten
  used: string[];
}

const VARIABLE_REGEX = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

/** Validation für Stay-Push-Texte (Title + Body). Erlaubt alle Marketing-
 *  Variablen + die 5 Stay-Push-Variablen. {{unsubscribe_link}} ist trotzdem
 *  verboten — Stay-Pushes haben keinen Opt-Out-Link (Vertragserfüllung). */
export function validateStayPushVariables(text: string): StayPushValidationResult {
  const found = new Set<string>();
  const re = new RegExp(VARIABLE_REGEX.source, VARIABLE_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.add(match[1].toLowerCase());
  }

  const allowed = new Set<string>(STAY_PUSH_ALLOWED_VARIABLES);
  const serverOnly = new Set<string>(SERVER_ONLY_VARIABLES);

  const unknown: string[] = [];
  const forbidden: string[] = [];
  const used: string[] = [];

  for (const v of found) {
    if (allowed.has(v)) used.push(v);
    else if (serverOnly.has(v)) forbidden.push(v);
    else unknown.push(v);
  }

  return { ok: unknown.length === 0 && forbidden.length === 0, unknown: unknown.sort(), forbidden: forbidden.sort(), used: used.sort() };
}

/** Pro Trigger-Typ: welche Variablen sind im UI sinnvoll/verfügbar?
 *  Wird für den Variable-Insert-Dropdown im Editor genutzt. Marketing-
 *  Variablen (first_name etc.) sind überall verfügbar — Stay-spezifische
 *  nur wo sie Sinn machen. */
export const STAY_PUSH_TRIGGER_VARIABLES: Record<string, readonly string[]> = {
  welcome:                [...HOTELIER_ALLOWED_VARIABLES, 'room_number'],
  service_confirmed:      [...HOTELIER_ALLOWED_VARIABLES, 'room_number'],
  service_declined:       [...HOTELIER_ALLOWED_VARIABLES],
  late_checkout_approved: [...HOTELIER_ALLOWED_VARIABLES, 'checkout_time', 'room_number'],
  restaurant_reservation: [...HOTELIER_ALLOWED_VARIABLES, 'guest_count', 'date', 'time'],
  spa_reservation:        [...HOTELIER_ALLOWED_VARIABLES, 'date', 'time'],
  housekeeping_done:      [...HOTELIER_ALLOWED_VARIABLES, 'room_number'],
  room_ready:             [...HOTELIER_ALLOWED_VARIABLES, 'room_number'],
  checkout_reminder:      [...HOTELIER_ALLOWED_VARIABLES, 'checkout_time', 'room_number'],
};

/** Trigger-Typ-Labels für UI */
export const STAY_PUSH_TRIGGER_LABELS: Record<string, string> = {
  welcome:                'Willkommen',
  service_confirmed:      'Service-Anfrage bestätigt',
  service_declined:       'Service-Anfrage abgelehnt',
  late_checkout_approved: 'Late-Checkout bestätigt',
  restaurant_reservation: 'Restaurant-Reservierung',
  spa_reservation:        'Spa-Termin',
  housekeeping_done:      'Housekeeping fertig',
  room_ready:             'Zimmer bereit',
  checkout_reminder:      'Check-out-Erinnerung',
};

export const STAY_PUSH_TRIGGER_DESCRIPTIONS: Record<string, string> = {
  welcome:                'Sendet beim ersten Wallet-Open während eines aktiven Aufenthalts',
  service_confirmed:      'Sendet wenn eine Service-Anfrage vom Hotelier bestätigt wird',
  service_declined:       'Sendet wenn eine Service-Anfrage abgelehnt wird',
  late_checkout_approved: 'Sendet wenn Late-Checkout vom Hotelier genehmigt wird',
  restaurant_reservation: 'Sendet wenn eine Restaurant-Buchung erstellt wird',
  spa_reservation:        'Sendet wenn ein Spa-Termin gebucht wird',
  housekeeping_done:      'Sendet wenn Housekeeping ein Zimmer als fertig markiert',
  room_ready:             'Manuell durch Hotelier ausgelöst (Button im Dashboard)',
  checkout_reminder:      'Sendet automatisch 1 Stunde vor stays.check_out (Cron alle 15 Min)',
};

export const STAY_PUSH_TRIGGER_ORDER = [
  'welcome',
  'service_confirmed',
  'service_declined',
  'restaurant_reservation',
  'spa_reservation',
  'late_checkout_approved',
  'housekeeping_done',
  'room_ready',
  'checkout_reminder',
] as const;
