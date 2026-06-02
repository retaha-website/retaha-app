// Sprint E2 · Phase 6 — Nearby-Cache-Build für Auto-Empfehlungen
//
// buildNearbyCache(hotelId, lat, lng) baut alle 5 Kategorien sequentiell
// (200ms sleep zwischen Calls für Rate-Limit-Friendliness).
// Pro Kategorie: 1× searchNearbyPlaces (Essentials-SKU $5/1k, 10k frei),
// upsert in hotel_place_nearby_cache.
//
// Wird aufgerufen von:
//   · Cron /api/cron/places-nearby-refresh (monatlich)
//   · Manual-Trigger /api/admin/places/refresh-nearby
//   · Auto-Trigger nach Geocoding in /admin/settings (non-blocking)

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { searchNearbyPlaces, type PickCategory } from './google-client';

const CATEGORIES: PickCategory[] = ['restaurant', 'cafe', 'bar', 'activity', 'sight'];
const SLEEP_BETWEEN_CATEGORIES_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface BuildNearbyResult {
  hotel_id: string;
  refreshed_categories: string[];
  failed_categories: Array<{ category: string; error: string }>;
  total_places_cached: number;
}

/**
 * Baut den Nearby-Cache für ein Hotel komplett auf (alle 5 Kategorien)
 * oder nur einen Subset. Bei Single-Category-Refresh (Hotelier-UI):
 * categories=['restaurant'] → nur 1 Google-Call.
 */
export async function buildNearbyCache(
  hotelId: string,
  lat: number,
  lng: number,
  categories: PickCategory[] = CATEGORIES,
): Promise<BuildNearbyResult> {
  const sb = createSupabaseServiceRoleInstance();
  const result: BuildNearbyResult = {
    hotel_id: hotelId,
    refreshed_categories: [],
    failed_categories: [],
    total_places_cached: 0,
  };

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    try {
      const places = await searchNearbyPlaces(lat, lng, category, {
        radius: 1500,
        maxResultCount: 20,
        languageCode: 'de',
      });

      // Minimal-Field-Mask landet in cached_places (gleich wie Google liefert):
      // placeId, name, formattedAddress, rating, userRatingCount, photoNames, location, types
      await sb
        .from('hotel_place_nearby_cache')
        .upsert(
          {
            hotel_id: hotelId,
            category,
            cached_places: places,
            last_refresh: new Date().toISOString(),
          },
          { onConflict: 'hotel_id,category' },
        );

      result.refreshed_categories.push(category);
      result.total_places_cached += places.length;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.error(`[nearby-actions] hotel ${hotelId} category ${category} failed:`, msg);
      result.failed_categories.push({ category, error: msg });
    }

    // Sleep zwischen Categories — nicht nach der letzten
    if (i < categories.length - 1) {
      await sleep(SLEEP_BETWEEN_CATEGORIES_MS);
    }
  }

  return result;
}
