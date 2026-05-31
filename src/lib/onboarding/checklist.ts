// Sprint Functional Modul B Phase 6 — Onboarding-Checkliste
//
// Read-Time-Check (Option B aus Briefing): pro Dashboard-Render fragen wir
// die echten Tabellen ab, statt auf Sync-Trigger zu setzen. Bei Pilot-Größe
// kein Performance-Problem (10 COUNT-Queries via Promise.all).
//
// Die boolean Flags in onboarding_state werden vom Wizard explizit gesetzt
// und sind das primäre "abgeschlossen" Signal. Diese Lib aggregiert beide
// Quellen: onboarding_state UND tatsächliche Daten — der Dashboard zeigt
// die Aggregation.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  href: string;        // Link zur entsprechenden Page
  done: boolean;
  required: boolean;   // Pflicht für completed_at-Auto-Setzen
}

export interface OnboardingChecklist {
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  isComplete: boolean;
  completed_at: string | null;
}

export async function getOnboardingChecklist(
  sb: SupabaseClient,
  hotelId: string,
): Promise<OnboardingChecklist> {
  // Parallel: alle Counts + onboarding_state
  const [
    stateRes,
    hotelRes,
    settingsRes,
    breakfastCount,
    knowledgeCount,
    actionCardsCount,
    placePicksCount,
    teamCount,
  ] = await Promise.all([
    sb.from('onboarding_state').select('*').eq('hotel_id', hotelId).maybeSingle(),
    sb.from('hotels').select('name, address_street, address_zip, city, latitude, longitude, default_language, enabled_languages').eq('id', hotelId).maybeSingle(),
    sb.from('hotel_settings').select('wifi_ssid, wifi_password, breakfast_start_time').eq('hotel_id', hotelId).maybeSingle(),
    sb.from('breakfast_items').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    sb.from('eve_knowledge').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    sb.from('hotel_action_cards').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    sb.from('hotel_place_picks').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    sb.from('hotel_users').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
  ]);

  const state = stateRes.data ?? {} as any;
  const hotel = hotelRes.data ?? {} as any;
  const settings = settingsRes.data ?? {} as any;

  const hasBasics = !!(hotel.name && hotel.default_language);
  const hasAddress = !!(hotel.address_street && hotel.address_zip && hotel.city);
  const hasGeocode = typeof hotel.latitude === 'number' && typeof hotel.longitude === 'number';
  const hasLanguages = Array.isArray(hotel.enabled_languages) && hotel.enabled_languages.length > 0;
  const hasWifi = !!(settings.wifi_ssid && settings.wifi_password);
  const hasBreakfast = (breakfastCount.count ?? 0) > 0;
  const hasKnowledge = (knowledgeCount.count ?? 0) >= 3;
  const hasActionCards = (actionCardsCount.count ?? 0) >= 1;
  const hasPlacePicks = (placePicksCount.count ?? 0) >= 3;
  const hasTeam = (teamCount.count ?? 0) >= 2;  // mind. 1 Mitarbeiter zusätzlich zum Owner

  const items: ChecklistItem[] = [
    { key: 'hotel_basics',     label: 'Hotel-Basics',          description: 'Name + Standardsprache',                 href: '/admin/settings', done: hasBasics || !!state.step_hotel_basics, required: true },
    { key: 'address',          label: 'Adresse',               description: 'Mit Geocoding für Empfehlungen',          href: '/admin/settings', done: (hasAddress && hasGeocode) || !!state.step_address, required: true },
    { key: 'languages',        label: 'Sprachen',              description: 'Welche Sprachen sehen Gäste?',            href: '/admin/settings', done: hasLanguages || !!state.step_languages, required: true },
    { key: 'mews',             label: 'Mews verknüpft',        description: 'PMS-Sync für Stays + Gäste',              href: '/admin/pms',      done: !!state.step_mews, required: false },
    { key: 'wifi',             label: 'WLAN-Daten',            description: 'SSID + Passwort',                         href: '/admin/settings', done: hasWifi || !!state.step_wifi, required: true },
    { key: 'breakfast',        label: 'Frühstücks-Items',      description: 'Was kann der Gast buchen?',               href: '/admin/breakfast', done: hasBreakfast || !!state.step_breakfast, required: false },
    { key: 'eve_knowledge',    label: 'Eve-Wissen (3+ FAQs)',  description: 'FAQs, Hausregeln, Tipps',                 href: '/admin/eve/knowledge', done: hasKnowledge, required: true },
    { key: 'action_cards',     label: 'Hero-Karten (1+)',      description: 'Konfigurierbare Cards im Gast-Hero',      href: '/admin/action-cards', done: hasActionCards, required: true },
    { key: 'place_picks',      label: 'Empfehlungs-Picks (3+)', description: 'Restaurants, Cafés, Aktivitäten',         href: '/admin/places',   done: hasPlacePicks, required: false },
    { key: 'team',             label: 'Team-Mitglied einladen', description: 'Manager oder Mitarbeiter',                href: '/admin/team',     done: hasTeam || !!state.step_team_invited, required: false },
  ];

  const doneCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const isComplete = items.filter(i => i.required).every(i => i.done);

  return {
    items,
    doneCount,
    totalCount,
    isComplete,
    completed_at: state.completed_at ?? null,
  };
}

/**
 * Markiert Onboarding als completed wenn alle required-Steps fertig.
 * Vom Dashboard-Render aufrufen — idempotent.
 */
export async function maybeMarkCompleted(
  sb: SupabaseClient,
  hotelId: string,
  checklist: OnboardingChecklist,
): Promise<void> {
  if (!checklist.isComplete || checklist.completed_at) return;
  await sb.from('onboarding_state').upsert({
    hotel_id: hotelId,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'hotel_id' });
}

/**
 * Setzt einen einzelnen Step explizit auf true (vom Wizard).
 */
export async function markStep(
  sb: SupabaseClient,
  hotelId: string,
  step: 'account' | 'hotel_basics' | 'address' | 'languages' | 'mews' | 'wifi' | 'breakfast' | 'eve_knowledge' | 'action_cards' | 'team_invited',
): Promise<void> {
  await sb.from('onboarding_state').upsert({
    hotel_id: hotelId,
    [`step_${step}`]: true,
  }, { onConflict: 'hotel_id' });
}
