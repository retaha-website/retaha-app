import { createServerClient } from './supabase';

export type StayContext = {
  stay: {
    id: string;
    check_in: string;
    check_out: string;
    is_active: boolean;
  };
  guest: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    language: string;
    visit_count: number;
  };
  room: {
    id: string;
    room_number: string | null;
    room_name: string | null;
  };
  hotel: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    default_language: string;
  };
  settings: {
    features: Record<string, boolean>;
    recommendations: any[];
    welcome_message_de: string;
    welcome_message_en: string;
    welcome_message_fr: string | null;
    welcome_message_es: string | null;
    hotel_eyebrow_de: string | null;
    hotel_eyebrow_en: string | null;
    hotel_eyebrow_fr: string | null;
    hotel_eyebrow_es: string | null;
    concierge_name: string;
    concierge_online_until: string | null;
    wifi_ssid: string | null;
    wifi_password: string | null;
    wifi_speed_mbits: number | null;
    breakfast_start_time: string | null;
    breakfast_end_time: string | null;
    breakfast_slot_minutes: number | null;
    breakfast_location_de: string | null;
    breakfast_location_en: string | null;
    breakfast_location_fr: string | null;
    breakfast_location_es: string | null;
    breakfast_included_de: string | null;
    breakfast_included_en: string | null;
    breakfast_included_fr: string | null;
    breakfast_included_es: string | null;
    conference_rooms: any[];
    conference_start_time: string | null;
    conference_end_time: string | null;
    conference_slot_minutes: number | null;
    service_items: any[];
    service_start_time: string | null;
    service_end_time: string | null;
  };
};

/**
 * Loads everything a guest page needs based on the access_token in the URL.
 * Uses the SERVICE_ROLE key on the server to bypass RLS — this is safe because:
 * - Token is the security boundary (long random UUID-ish string)
 * - We only return data linked to this specific stay
 * Returns null if token is invalid or stay is not active.
 */
export async function loadStayByToken(token: string): Promise<StayContext | null> {
  if (!token || token.length < 20) return null;

  const supabase = createServerClient();

  const { data: stay, error: stayErr } = await supabase
    .from('stays')
    .select(`
      id, check_in, check_out, is_active,
      guest:guests(id, first_name, last_name, language, visit_count),
      room:rooms(id, room_number, room_name),
      hotel:hotels(id, slug, name, city, default_language)
    `)
    .eq('access_token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (stayErr || !stay || !stay.guest || !stay.room || !stay.hotel) {
    console.error('loadStayByToken: stay lookup failed', stayErr);
    return null;
  }

  const { data: settings, error: setErr } = await supabase
    .from('hotel_settings')
    .select(`
      features, recommendations,
      welcome_message_de, welcome_message_en, welcome_message_fr, welcome_message_es,
      hotel_eyebrow_de, hotel_eyebrow_en, hotel_eyebrow_fr, hotel_eyebrow_es,
      concierge_name, concierge_online_until,
      wifi_ssid, wifi_password, wifi_speed_mbits,
      breakfast_start_time, breakfast_end_time, breakfast_slot_minutes,
      breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es,
      breakfast_included_de, breakfast_included_en, breakfast_included_fr, breakfast_included_es,
      conference_rooms, conference_start_time, conference_end_time, conference_slot_minutes,
      service_items, service_start_time, service_end_time
    `)
    .eq('hotel_id', (stay.hotel as any).id)
    .maybeSingle();

  if (setErr || !settings) {
    console.error('loadStayByToken: settings lookup failed', setErr);
    return null;
  }

  return {
    stay: { id: stay.id, check_in: stay.check_in, check_out: stay.check_out, is_active: stay.is_active },
    guest: stay.guest as any,
    room: stay.room as any,
    hotel: stay.hotel as any,
    settings: settings as any,
  };
}

export async function loadBookingsForStay(stayId: string, type?: string) {
  const supabase = createServerClient();
  let query = supabase
    .from('bookings')
    .select('id, type, status, details, created_at, updated_at')
    .eq('stay_id', stayId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadBookingsForStay error:', error);
    return [];
  }
  return data || [];
}

export interface BookingWithGuest {
  id: string;
  type: string;
  status: string;
  details: any;
  created_at: string;
  updated_at: string;
  stay: {
    id: string;
    check_in: string;
    check_out: string;
    room: {
      room_number: string | null;
      room_name: string | null;
    } | null;
    guest: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

export async function loadBookingsForHotel(hotelId: string, type?: string): Promise<BookingWithGuest[]> {
  const supabase = createServerClient();
  let query = supabase
    .from('bookings')
    .select(`
      id, type, status, details, created_at, updated_at,
      stay:stays (
        id, check_in, check_out,
        room:rooms (room_number, room_name),
        guest:guests (first_name, last_name)
      )
    `)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadBookingsForHotel error:', error);
    return [];
  }
  return (data || []) as any;
}

export interface BreakfastItem {
  id: string;
  hotel_id: string;
  display_order: number;
  is_active: boolean;
  category: string | null;

  name_de: string;
  name_en: string | null;
  name_fr: string | null;
  name_es: string | null;

  description_de: string | null;
  description_en: string | null;
  description_fr: string | null;
  description_es: string | null;

  // 14 EU Allergens
  contains_gluten: boolean;
  contains_crustaceans: boolean;
  contains_eggs: boolean;
  contains_fish: boolean;
  contains_peanuts: boolean;
  contains_soy: boolean;
  contains_milk: boolean;
  contains_nuts: boolean;
  contains_celery: boolean;
  contains_mustard: boolean;
  contains_sesame: boolean;
  contains_sulfites: boolean;
  contains_lupins: boolean;
  contains_molluscs: boolean;

  is_vegetarian: boolean;
  is_vegan: boolean;
  is_organic: boolean;

  created_at: string;
  updated_at: string;
}

export async function loadBreakfastItems(hotelId: string): Promise<BreakfastItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('breakfast_items')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('loadBreakfastItems error:', error);
    return [];
  }
  return (data || []) as BreakfastItem[];
}

export async function loadBreakfastItem(itemId: string, hotelId: string): Promise<BreakfastItem | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('breakfast_items')
    .select('*')
    .eq('id', itemId)
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (error) {
    console.error('loadBreakfastItem error:', error);
    return null;
  }
  return data as BreakfastItem | null;
}

export async function loadActiveBreakfastItems(hotelId: string): Promise<BreakfastItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('breakfast_items')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('loadActiveBreakfastItems error:', error);
    return [];
  }
  return (data || []) as BreakfastItem[];
}

// EU 14 allergen helper — for both forms and labels
export const EU_ALLERGENS = [
  { key: 'gluten', label_de: 'Glutenhaltiges Getreide', label_en: 'Gluten', label_fr: 'Gluten', label_es: 'Gluten' },
  { key: 'crustaceans', label_de: 'Krebstiere', label_en: 'Crustaceans', label_fr: 'Crustacés', label_es: 'Crustáceos' },
  { key: 'eggs', label_de: 'Eier', label_en: 'Eggs', label_fr: 'Œufs', label_es: 'Huevos' },
  { key: 'fish', label_de: 'Fisch', label_en: 'Fish', label_fr: 'Poisson', label_es: 'Pescado' },
  { key: 'peanuts', label_de: 'Erdnüsse', label_en: 'Peanuts', label_fr: 'Arachides', label_es: 'Cacahuetes' },
  { key: 'soy', label_de: 'Soja', label_en: 'Soy', label_fr: 'Soja', label_es: 'Soja' },
  { key: 'milk', label_de: 'Milch', label_en: 'Milk', label_fr: 'Lait', label_es: 'Leche' },
  { key: 'nuts', label_de: 'Schalenfrüchte (Nüsse)', label_en: 'Tree nuts', label_fr: 'Fruits à coque', label_es: 'Frutos secos' },
  { key: 'celery', label_de: 'Sellerie', label_en: 'Celery', label_fr: 'Céleri', label_es: 'Apio' },
  { key: 'mustard', label_de: 'Senf', label_en: 'Mustard', label_fr: 'Moutarde', label_es: 'Mostaza' },
  { key: 'sesame', label_de: 'Sesam', label_en: 'Sesame', label_fr: 'Sésame', label_es: 'Sésamo' },
  { key: 'sulfites', label_de: 'Sulfite', label_en: 'Sulphites', label_fr: 'Sulfites', label_es: 'Sulfitos' },
  { key: 'lupins', label_de: 'Lupinen', label_en: 'Lupin', label_fr: 'Lupin', label_es: 'Altramuces' },
  { key: 'molluscs', label_de: 'Weichtiere', label_en: 'Molluscs', label_fr: 'Mollusques', label_es: 'Moluscos' },
] as const;
