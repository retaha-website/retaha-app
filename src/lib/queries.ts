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
    room_number: string;
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
      breakfast_included_de, breakfast_included_en, breakfast_included_fr, breakfast_included_es
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
      room_number: string;
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
