// Sprint E2 · Phase 4 + Phase 5 — Place-Pick Domain-Actions
//
// addPickToHotel: fetched Google Place Details (Atmosphere), schreibt INSERT
// in hotel_place_picks mit cached_data + photo_references.
//
// Caller (POST-Handler in /admin/places) ist Hotelier-authentifiziert via
// createSupabaseServerInstance — RLS-Policies (Phase 1b) lassen INSERT nur
// für user_hotel_ids() durch.

import { getPlaceDetails, type PlaceDetails } from './google-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickCategory } from './google-client';

export interface AddPickResult {
  ok: boolean;
  pickId?: string;
  error?: string;
}

export async function addPickToHotel(
  client: SupabaseClient,
  hotelId: string,
  placeId: string,
  category: PickCategory,
  languageCode: string = 'de',
): Promise<AddPickResult> {
  let details: PlaceDetails;
  try {
    details = await getPlaceDetails(placeId, { includeAtmosphere: true, languageCode });
  } catch (err) {
    return { ok: false, error: `Google Place Details fehlgeschlagen: ${(err as Error).message}` };
  }

  const cachedData = {
    name: details.name,
    formatted_address: details.formattedAddress,
    location: details.location,
    types: details.types,
    google_maps_uri: details.googleMapsUri,
    rating: details.rating,
    user_ratings_total: details.userRatingCount,
    price_level: details.priceLevel,
    website_uri: details.websiteUri,
    international_phone_number: details.internationalPhoneNumber,
    opening_hours: details.openingHours,
    reviews: details.reviews?.slice(0, 3),
  };

  const { data, error } = await client
    .from('hotel_place_picks')
    .insert({
      hotel_id: hotelId,
      place_id: placeId,
      category,
      cached_data: cachedData,
      photo_references: details.photoNames,
      last_refresh: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // UNIQUE constraint: place_id schon als Pick für dieses Hotel
    if (error.code === '23505') {
      return { ok: false, error: 'Dieses Place ist bereits als Pick gespeichert.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, pickId: data!.id };
}
