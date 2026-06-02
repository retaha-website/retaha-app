// Sprint Wallet · Phase 9 — Marketing-Template-Variablen-System
//
// Hotelier darf in TipTap-Body Variablen wie {{first_name}} verwenden.
// Wir definieren eine ALLOWLIST damit unbekannte/sensible Variablen nicht
// durchrutschen (z.B. {{guest_email}}, {{secret_key}}).
//
// Footer-Variablen wie {{unsubscribe_link}} werden vom Server beim Send
// IMMER ersetzt — der Hotelier selbst darf sie aber nicht ins Body schreiben.

export type VariableContext = {
  first_name: string;
  last_name: string;
  hotel_name: string;
  visit_count: number;
  last_visit_date: string;   // formatiert (DE: 24.12.2025)
  first_visit_date: string;
};

/** Variablen die der Hotelier in Marketing-Templates verwenden darf */
export const HOTELIER_ALLOWED_VARIABLES = [
  'first_name',
  'last_name',
  'hotel_name',
  'visit_count',
  'last_visit_date',
  'first_visit_date',
] as const;

/** Sprint Wallet Modul D — zusätzliche Variablen für Stay-Push-Templates.
 *  Werden mit Stay/Booking-Context beim Send befüllt. */
export const STAY_PUSH_ALLOWED_VARIABLES = [
  ...HOTELIER_ALLOWED_VARIABLES,
  'checkout_time',   // stays.check_out HH:MM
  'room_number',     // rooms.room_number
  'guest_count',     // bookings.details.guests / .people
  'date',            // bookings.details.date
  'time',            // bookings.details.time
] as const;

/** Variablen die NUR der Server beim Send einsetzt (Footer/Compliance) */
export const SERVER_ONLY_VARIABLES = [
  'unsubscribe_link',
] as const;

export type HotelierVariable = typeof HOTELIER_ALLOWED_VARIABLES[number];
export type ServerOnlyVariable = typeof SERVER_ONLY_VARIABLES[number];

const VARIABLE_REGEX = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

export interface VariableValidationResult {
  ok: boolean;
  /** {{xxx}} die der Hotelier verwendet hat aber nicht erlaubt sind */
  unknownVariables: string[];
  /** Variablen die nur der Server setzen darf */
  forbiddenVariables: string[];
  /** Erlaubte Variablen die tatsächlich verwendet wurden */
  usedAllowed: string[];
}

/**
 * Findet alle {{xxx}}-Variablen in einem Text und prüft die gegen die
 * Allowlist. Returnt eine Liste verbotener/unbekannter Variablen.
 *
 * Verwendet beim Template-Save: ist `ok=false`, wird der Save abgewiesen.
 */
export function validateVariables(text: string): VariableValidationResult {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  // RegExp.exec mit /g braucht eigene loop
  const re = new RegExp(VARIABLE_REGEX.source, VARIABLE_REGEX.flags);
  while ((match = re.exec(text)) !== null) {
    found.add(match[1].toLowerCase());
  }

  const allowed = new Set<string>(HOTELIER_ALLOWED_VARIABLES);
  const serverOnly = new Set<string>(SERVER_ONLY_VARIABLES);

  const unknownVariables: string[] = [];
  const forbiddenVariables: string[] = [];
  const usedAllowed: string[] = [];

  for (const v of found) {
    if (allowed.has(v)) usedAllowed.push(v);
    else if (serverOnly.has(v)) forbiddenVariables.push(v);
    else unknownVariables.push(v);
  }

  return {
    ok: unknownVariables.length === 0 && forbiddenVariables.length === 0,
    unknownVariables: unknownVariables.sort(),
    forbiddenVariables: forbiddenVariables.sort(),
    usedAllowed: usedAllowed.sort(),
  };
}

/**
 * Ersetzt {{xxx}}-Platzhalter mit echten Werten beim Send.
 * Unbekannte Platzhalter bleiben unverändert (defensive: nicht crashen,
 * nicht silently entfernen — sondern als-ist durchreichen für Debugging).
 *
 * @param text  Template-Body
 * @param ctx   Werte für die erlaubten Variablen
 * @param footerVars  Server-only Variablen (z.B. unsubscribe_link)
 */
export function renderVariables(
  text: string,
  ctx: VariableContext,
  footerVars: Partial<Record<ServerOnlyVariable, string>> = {},
): string {
  return text.replace(VARIABLE_REGEX, (full, name) => {
    const key = (name as string).toLowerCase();
    if (key in ctx) {
      const value = ctx[key as HotelierVariable];
      return value !== undefined && value !== null ? String(value) : '';
    }
    if (key in footerVars) {
      return footerVars[key as ServerOnlyVariable] || '';
    }
    return full;  // unverändert lassen
  });
}

/**
 * Variable-Definitionen für die UI (Dropdown-Menu im Editor).
 * In der Reihenfolge wie der Hotelier sie sieht.
 */
export const VARIABLE_UI_DEFS: Array<{
  key: HotelierVariable;
  label: string;
  example: string;
}> = [
  { key: 'first_name',       label: 'Vorname',           example: 'Anna' },
  { key: 'last_name',        label: 'Nachname',          example: 'Schmidt' },
  { key: 'hotel_name',       label: 'Hotel-Name',        example: 'Gate Garden Hotel Berlin' },
  { key: 'visit_count',      label: 'Anzahl Besuche',    example: '3' },
  { key: 'last_visit_date',  label: 'Letzter Besuch',    example: '24.12.2025' },
  { key: 'first_visit_date', label: 'Erster Besuch',     example: '15.07.2024' },
];
