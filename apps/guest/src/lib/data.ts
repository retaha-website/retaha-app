/**
 * Guest-app data layer.
 * Sits above @retaha/db — wraps loadStayByToken and provides typed helpers
 * for all sheets (action cards, places, breakfast items).
 */

import { loadStayByToken, loadActiveBreakfastItems } from '@retaha/db';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { pickI18n } from '@retaha/i18n';
import type { Lang } from '@retaha/i18n';

// ── GuestContext ─────────────────────────────────────────────────────────────

export interface GuestHotel {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  default_language: string;
  logo_primary: string | null;
  logo_dark: string | null;
  splash_background: string | null;
  design_identity: 'bauhaus' | 'editorial' | 'maison' | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GuestContext {
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
  } | null;
  room: {
    id: string;
    room_number: string | null;
    room_name: string | null;
  } | null;
  hotel: GuestHotel;
  settings: Record<string, any>;
}

/**
 * Loads the full guest context for a token.
 * Extends loadStayByToken (from @retaha/db) with design_identity, logo_dark,
 * splash_background and geo-coordinates — fields the base query omits.
 */
export async function fetchGuestContext(token: string): Promise<GuestContext | null> {
  const ctx = await loadStayByToken(token);
  if (!ctx) return null;

  const sb = createSupabaseServiceRoleInstance();
  const { data: extra } = await sb
    .from('hotels')
    .select('design_identity, logo_primary, logo_dark, splash_background, latitude, longitude')
    .eq('id', ctx.hotel.id)
    .maybeSingle();

  return {
    stay: ctx.stay,
    guest: ctx.guest,
    room: ctx.room,
    hotel: {
      ...ctx.hotel,
      design_identity: (extra?.design_identity as GuestHotel['design_identity']) ?? null,
      logo_primary: (extra?.logo_primary as string | null) ?? null,
      logo_dark: (extra?.logo_dark as string | null) ?? null,
      splash_background: (extra?.splash_background as string | null) ?? null,
      latitude: (extra?.latitude as number | null) ?? null,
      longitude: (extra?.longitude as number | null) ?? null,
    },
    settings: ctx.settings as Record<string, any>,
  };
}

// ── Action cards ─────────────────────────────────────────────────────────────

export interface ActionCard {
  id: string;
  cardType: string;
  actionTarget: string | null;
  imageUrl: string | null;
  eyebrow: string;
  title: string;
  sub: string;
  cta: string;
  cardClass: string;
  icon: 'sun' | 'square' | 'triangle';
}

function iconForCardType(cardType: string): ActionCard['icon'] {
  if (cardType === 'external_link') return 'square';
  if (['phone', 'email', 'info'].includes(cardType)) return 'triangle';
  return 'sun';
}

/**
 * Fetches published action cards for a hotel, i18n-resolved to the guest's language.
 */
export async function fetchActionCards(
  hotelId: string,
  lang: string,
  hotelDefaultLang: string,
): Promise<ActionCard[]> {
  const sb = createSupabaseServiceRoleInstance();
  const { data: rows } = await sb
    .from('hotel_action_cards')
    .select([
      'id', 'card_type', 'action_target', 'image_url', 'card_class', 'sort_order',
      'title_de', 'title_i18n',
      'subtitle_de', 'subtitle_i18n',
      'eyebrow_de', 'eyebrow_i18n',
      'cta_de', 'cta_i18n',
    ].join(', '))
    .eq('hotel_id', hotelId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  return (rows ?? []).map((card: any): ActionCard => ({
    id: card.id,
    cardType: card.card_type,
    actionTarget: card.action_target ?? null,
    imageUrl: card.image_url ?? null,
    eyebrow: pickI18n(card.eyebrow_i18n, hotelDefaultLang as Lang, lang as Lang) || card.eyebrow_de || '',
    title:   pickI18n(card.title_i18n,   hotelDefaultLang as Lang, lang as Lang) || card.title_de   || '',
    sub:     pickI18n(card.subtitle_i18n, hotelDefaultLang as Lang, lang as Lang) || card.subtitle_de || '',
    cta:     pickI18n(card.cta_i18n,     hotelDefaultLang as Lang, lang as Lang) || card.cta_de     || '',
    cardClass: card.card_class || 'rec-anthrazit',
    icon: iconForCardType(card.card_type),
  }));
}

// ── Recommendations / Places ─────────────────────────────────────────────────

export interface PlacePick {
  id: string;
  place_id: string;
  category: string;
  hotel_note: string | null;
  hotel_note_en: string | null;
  hotel_note_fr: string | null;
  hotel_note_es: string | null;
  cached_data: Record<string, any> | null;
  photo_references: string[] | null;
  sort_order: number;
}

export interface PlaceNearbyCache {
  category: string;
  cached_places: any[];
}

export interface RecommendationsData {
  picks: PlacePick[];
  nearby: PlaceNearbyCache[];
  hotelLat: number | null;
  hotelLng: number | null;
}

/**
 * Fetches hotel place picks + nearby cache for the Places/Recommendations sheet.
 * hotelLat/hotelLng can be passed in directly if already fetched via fetchGuestContext.
 */
export async function fetchRecommendations(
  hotelId: string,
  hotelLat?: number | null,
  hotelLng?: number | null,
): Promise<RecommendationsData> {
  const sb = createSupabaseServiceRoleInstance();
  const [{ data: picks }, { data: nearby }] = await Promise.all([
    sb
      .from('hotel_place_picks')
      .select([
        'id', 'place_id', 'category', 'sort_order',
        'hotel_note', 'hotel_note_en', 'hotel_note_fr', 'hotel_note_es',
        'cached_data', 'photo_references',
      ].join(', '))
      .eq('hotel_id', hotelId)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    sb
      .from('hotel_place_nearby_cache')
      .select('category, cached_places')
      .eq('hotel_id', hotelId),
  ]);

  return {
    picks: (picks ?? []) as PlacePick[],
    nearby: (nearby ?? []) as PlaceNearbyCache[],
    hotelLat: hotelLat ?? null,
    hotelLng: hotelLng ?? null,
  };
}

// ── Breakfast items ──────────────────────────────────────────────────────────

export { loadActiveBreakfastItems as fetchBreakfastItems };
