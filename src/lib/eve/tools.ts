// Sprint E4 · Phase 7 — Tool-Definitionen für Eve
//
// 6 Lookup-Tools (read-only, direkt ausführbar):
//   get_stay_details, get_breakfast_menu, get_recommendations,
//   get_active_bookings, get_conference_rooms, get_hotel_info
//
// 4 Action-Tools (write — IMMER mit Confirmation-Step):
//   create_breakfast_booking, request_service, request_conference_room,
//   cancel_booking
//
// WICHTIG: stay_id ist NIE Tool-Input — kommt aus Stay-Session-Cookie via
// EveExecutionContext. Verhindert dass Eve manipuliert wird andere Stays
// anzufassen.

import type Anthropic from '@anthropic-ai/sdk';

export const EVE_TOOLS: Anthropic.Tool[] = [
  // ============================================================
  // LOOKUP TOOLS (read-only, direkt vom Backend ausgeführt)
  // ============================================================
  {
    name: 'get_stay_details',
    description: 'Holt die Details zum aktuellen Aufenthalt des Gastes: Check-in/out-Datum, Zimmer-Nummer, Gast-Name. Nutze das wenn der Gast nach diesen Informationen fragt.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_breakfast_menu',
    description: 'Gibt die verfügbaren Frühstücks-Items des Hotels zurück (Name, Preis, Diet-Flags wie vegan/vegetarisch, Allergene). Nutze das wenn der Gast nach Frühstücks-Optionen oder Preisen fragt.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_recommendations',
    description: `Liefert Empfehlungen für den Gast in der Hotel-Nachbarschaft.
Backend liefert ZWEI Listen:
- picks: Hotelier-kuratierte Premium-Empfehlungen mit Hotel-Notiz (is_pick=true).
  Diese sind IMMER priorisiert.
- auto: Auto-Empfehlungen aus Google Places (top 10 nach Rating sortiert),
  Dedup gegen Picks bereits erledigt.

Jeder Eintrag hat: name, rating, review_count, price_level, walking_minutes,
opening_hours_text, is_open_now (bei Picks). Picks zusätzlich: hotel_note.

Best-Practice für deine Antwort:
- Wenn picks für die gefragte Kategorie da: erwähne diese ZUERST mit der
  hotel_note (Premium-Differenzierung — das ist warum der Hotelier zahlt)
- Ergänze mit 1-3 auto-Empfehlungen wenn relevant
- Bei filter_hint ("romantisch", "günstig", "vegan", "ruhig"): filtere
  selbst basierend auf rating (>=4.5 für "Premium"), price_level, types,
  und ggf. hotel_note-Inhalt
- Erwähne IMMER die walking_minutes wenn vorhanden ("5 Min zu Fuß")
- Bei leeren Listen: ehrlich sagen + zur Rezeption verweisen`,
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['restaurant', 'cafe', 'bar', 'activity', 'sight', 'all'],
          description: 'Kategorie. "all" wenn der Gast unklar fragt oder gemischte Empfehlungen will.',
        },
        filter_hint: {
          type: 'string',
          description: 'Optional: was der Gast sucht (z.B. "romantisch", "günstig", "vegan", "ruhig", "open jetzt"). Du nutzt das beim Filtern + bei der Antwort-Formulierung.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_active_bookings',
    description: 'Listet die aktuellen Buchungen des Gastes für seinen aktuellen Aufenthalt (Frühstück, Service-Anfragen, Konferenz-Räume mit Status pending/confirmed/cancelled).',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_conference_rooms',
    description: 'Listet die verfügbaren Konferenz-Räume des Hotels mit Kapazität und Buchungs-Slots. Nutze das wenn der Gast nach Meeting-Räumen, Tagungen oder Besprechungs-Möglichkeiten fragt.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_hotel_info',
    description: 'Liefert allgemeine Hotel-Infos: WLAN-Daten (SSID + Passwort), Frühstücks-Zeiten und -Ort, Hotel-Adresse, Konferenz-Verfügbarkeitszeiten. Nutze das für klassische FAQ-artige Anfragen.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ============================================================
  // ACTION TOOLS (Confirmation-Step ZWANG — nicht direkt ausgeführt!)
  // ============================================================
  {
    name: 'create_breakfast_booking',
    description: `Bereitet eine Frühstücks-Buchung zur Bestätigung vor. KRITISCH: Dieser Tool-Call ERSTELLT noch nichts — er bereitet nur einen Bestätigungs-Dialog für den Gast vor. Der Gast muss explizit "Bestätigen" klicken bevor die Buchung erstellt wird.

Best-Practice: Zeige zuerst dem Gast die Items + Summe in deiner Text-Antwort und frage "Soll ich das so für dich buchen?". Erst nach explizitem JA rufst du diesen Tool auf.`,
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Liste der zu bestellenden Frühstücks-Items mit Anzahl.',
          items: {
            type: 'object',
            properties: {
              breakfast_item_id: { type: 'string', description: 'ID aus get_breakfast_menu' },
              name: { type: 'string', description: 'Name für Anzeige im Confirmation-Dialog (z.B. "Granola mit Beeren")' },
              quantity: { type: 'number', description: 'Anzahl der Items (default 1)' },
              price_cents: { type: 'number', description: 'Preis pro Item in Cent (für Summen-Anzeige)' },
            },
            required: ['breakfast_item_id', 'name', 'quantity'],
          },
        },
        date: { type: 'string', description: 'Datum im ISO-Format YYYY-MM-DD' },
        time_slot: { type: 'string', description: 'Uhrzeit z.B. "08:30"' },
        people: { type: 'number', description: 'Anzahl Personen (default 1)' },
        table_preference: { type: 'string', enum: ['inside', 'outside', 'any'], description: 'Sitzplatz-Wunsch wenn angegeben.' },
      },
      required: ['items', 'date', 'time_slot'],
    },
  },
  {
    name: 'request_service',
    description: `Bereitet eine Service-Anfrage zur Bestätigung vor (Late-Check-out, Wäscheservice, Wake-up-Call, Taxi, etc.). KRITISCH: nur Vorbereitung, nicht Ausführung — Gast muss bestätigen.`,
    input_schema: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          enum: ['late_checkout', 'laundry', 'wakeup_call', 'taxi', 'other'],
          description: 'Art des Services.',
        },
        item_name: { type: 'string', description: 'Beschreibender Name für Confirmation-Dialog (z.B. "Late-Check-out bis 13:00").' },
        details: { type: 'string', description: 'Frei-Text mit Details (z.B. Zeit, Adresse für Taxi, etc.).' },
        date: { type: 'string', description: 'Datum im ISO-Format YYYY-MM-DD wenn relevant.' },
        time: { type: 'string', description: 'Uhrzeit wenn relevant.' },
      },
      required: ['service_type', 'item_name'],
    },
  },
  {
    name: 'request_conference_room',
    description: `Bereitet eine Konferenz-Raum-Buchung zur Bestätigung vor. KRITISCH: nur Vorbereitung — Verfügbarkeit prüfen vorher mit get_conference_rooms!`,
    input_schema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'ID des Konferenz-Raums aus get_conference_rooms.' },
        room_name: { type: 'string', description: 'Name für Confirmation-Dialog.' },
        date: { type: 'string', description: 'Datum YYYY-MM-DD' },
        time_start: { type: 'string', description: 'Start-Zeit HH:MM' },
        time_end: { type: 'string', description: 'End-Zeit HH:MM' },
        duration_hours: { type: 'number', description: 'Dauer in Stunden (berechnet aus start/end).' },
        people: { type: 'number', description: 'Erwartete Personenzahl.' },
      },
      required: ['room_id', 'room_name', 'date', 'time_start', 'time_end'],
    },
  },
  {
    name: 'cancel_booking',
    description: `Bereitet die Stornierung einer bestehenden Buchung des Gastes zur Bestätigung vor. KRITISCH: nur Vorbereitung. Booking-ID muss aus get_active_bookings stammen.`,
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'ID aus get_active_bookings.' },
        booking_label: { type: 'string', description: 'Beschreibung für Confirmation-Dialog (z.B. "Frühstück morgen 8:30 — 2 Personen").' },
        reason: { type: 'string', description: 'Optionaler Grund vom Gast.' },
      },
      required: ['booking_id', 'booking_label'],
    },
  },
];

// ============================================================
// Tool-Names als const für Type-Safety im Executor
// ============================================================

export const LOOKUP_TOOL_NAMES = [
  'get_stay_details',
  'get_breakfast_menu',
  'get_recommendations',
  'get_active_bookings',
  'get_conference_rooms',
  'get_hotel_info',
] as const;

export const ACTION_TOOL_NAMES = [
  'create_breakfast_booking',
  'request_service',
  'request_conference_room',
  'cancel_booking',
] as const;

export type LookupToolName = typeof LOOKUP_TOOL_NAMES[number];
export type ActionToolName = typeof ACTION_TOOL_NAMES[number];

export function isLookupTool(name: string): name is LookupToolName {
  return (LOOKUP_TOOL_NAMES as readonly string[]).includes(name);
}

export function isActionTool(name: string): name is ActionToolName {
  return (ACTION_TOOL_NAMES as readonly string[]).includes(name);
}
