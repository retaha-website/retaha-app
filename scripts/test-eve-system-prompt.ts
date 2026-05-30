// Sprint E4 · Phase 6 — System-Prompt-Builder Test
//
// Run via: npm run test:eve-system-prompt
//
// Lädt das Demo-Hotel + dessen eve_knowledge + Tuning-Rules aus DB,
// optional einen aktiven Stay, baut den System-Prompt + zeigt ihn an.
// Plus Token-Estimate + manuelle Sanity-Inspection-Hilfe.

import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt, type EveContext } from '../src/lib/eve/system-prompt';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in .env stehen');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function main() {
  // 1. Hotel + Settings laden
  const { data: hotel } = await sb
    .from('hotels')
    .select('id, name, city, country')
    .eq('id', DEMO_HOTEL_ID)
    .single();
  const { data: settings } = await sb
    .from('hotel_settings')
    .select(`
      eve_name, eve_tonality, eve_custom_persona, eve_tuning_rules,
      guest_address_form,
      wifi_ssid, wifi_password, wifi_speed_mbits,
      breakfast_start_time, breakfast_end_time,
      breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es,
      conference_rooms, conference_start_time, conference_end_time
    `)
    .eq('hotel_id', DEMO_HOTEL_ID)
    .single();

  if (!hotel || !settings) {
    console.error('Demo-Hotel oder Settings nicht gefunden');
    process.exit(1);
  }

  // 2. Knowledge laden
  const { data: knowledge } = await sb
    .from('eve_knowledge')
    .select('category, question, answer, sort_order, created_at')
    .eq('hotel_id', DEMO_HOTEL_ID)
    .eq('language_code', 'de')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  // 3. Aktiver Stay (optional)
  const { data: stays } = await sb
    .from('stays')
    .select(`
      id, check_in, check_out, raw_mews_data,
      guests(first_name, last_name, language),
      rooms(room_number, room_name)
    `)
    .eq('hotel_id', DEMO_HOTEL_ID)
    .eq('is_active', true)
    .in('state', ['Confirmed', 'Started'])
    .order('check_in', { ascending: false })
    .limit(1);
  const firstStay = stays?.[0] ?? null;

  // ─── Test A: ohne Stay (Gast nicht eingeloggt), Sprache DE ─────────
  divider('Test A — Anonymous Visitor (no stay), Lang DE');
  const ctxA: EveContext = {
    hotel: hotel as any,
    hotelSettings: settings as any,
    knowledge: (knowledge ?? []) as any,
    language: 'de',
  };
  const promptA = buildSystemPrompt(ctxA);
  console.log('');
  console.log(promptA);

  // ─── Test B: mit Stay (Gast eingeloggt), Sprache DE ────────────────
  if (firstStay) {
    divider('Test B — With Stay (' + (firstStay.guests as any)?.first_name + ' ' + (firstStay.guests as any)?.last_name + '), Lang DE');
    const ctxB: EveContext = {
      hotel: hotel as any,
      hotelSettings: settings as any,
      stay: {
        id: firstStay.id,
        check_in: firstStay.check_in,
        check_out: firstStay.check_out,
        raw_mews_data: firstStay.raw_mews_data,
      },
      guest: firstStay.guests as any,
      room: firstStay.rooms as any,
      knowledge: (knowledge ?? []) as any,
      language: 'de',
    };
    const promptB = buildSystemPrompt(ctxB);
    console.log('');
    console.log(promptB);
  } else {
    divider('Test B — SKIPPED (kein aktiver Stay im Demo-Hotel)');
  }

  // ─── Test C: mit Stay, Sprache EN (Übersetzungs-Hint sichtbar) ─────
  if (firstStay) {
    divider('Test C — With Stay, Lang EN (Übersetzungs-Hint im Prompt)');
    const ctxC: EveContext = {
      hotel: hotel as any,
      hotelSettings: settings as any,
      stay: {
        id: firstStay.id,
        check_in: firstStay.check_in,
        check_out: firstStay.check_out,
        raw_mews_data: firstStay.raw_mews_data,
      },
      guest: firstStay.guests as any,
      room: firstStay.rooms as any,
      knowledge: (knowledge ?? []) as any,
      language: 'en',
    };
    const promptC = buildSystemPrompt(ctxC);
    console.log('');
    console.log(promptC);
  }

  divider('Sanity-Inspection');
  console.log('Bitte manuell prüfen:');
  console.log('  - Persona-Section: klingt sie wie eine Premium-Hotel-Concierge?');
  console.log('  - Anrede ("Sie" oder "du") konsistent über alle Sections?');
  console.log('  - Knowledge-Section: lesbar, FAQs als Q/A-Pairs?');
  console.log('  - Tuning-Rules: nummeriert, mit Trigger + Instruction?');
  console.log('  - EN-Test C: Übersetzungs-Instruktion am Ende sichtbar?');
  console.log('  - Token-Estimate im Cache-Bereich (>= 1024 für Sonnet)?');
  console.log('');
}

main().catch(err => {
  console.error('FEHLER:', err);
  process.exit(1);
});
