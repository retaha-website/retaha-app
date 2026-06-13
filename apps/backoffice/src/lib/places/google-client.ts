// Sprint E2 · Phase 2 — Google Places (New) API v1 Client
//
// API-Doku: https://developers.google.com/maps/documentation/places/web-service/op-overview
//
// Authentication: X-Goog-Api-Key Header (kein Query-Param, sicherer).
// Field-Mask via X-Goog-FieldMask Header — KRITISCH für SKU-Klassifikation.
//
// SKU-Übersicht (Stand 2026):
//   · Autocomplete (Per Session)            $2.83 / 1000    (5000 Sessions/Monat free)
//   · Nearby Search Essentials              $5    / 1000    (10000 Calls/Monat free)
//   · Place Details Essentials              $5    / 1000    (10000 Calls/Monat free)
//   · Place Details Atmosphere              $20   / 1000    (1000 Calls/Monat free)
//   · Photos (Per Request)                  $7    / 1000    (per maxWidthPx Variante)
//
// Field-Mask-Disziplin: jeder API-Call setzt nur die Felder die wir wirklich
// brauchen — sonst eskaliert die SKU-Stufe automatisch.

import { getEnv } from '@retaha/db';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function getApiKey(): string {
  const key = getEnv('GOOGLE_PLACES_API_KEY');
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY ist nicht gesetzt');
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.floor(Math.random() * 250);
}

class PlacesApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'PlacesApiError';
  }
}

/**
 * Internal fetch helper mit Retry-Logic (analog zu Anthropic-Wrapper).
 * 429 → exp.backoff (1s/2s/4s), 5xx → backoff+jitter, max 3 retries.
 * 4xx (außer 429) → fail-fast.
 */
async function placesFetch<T>(
  url: string,
  init: RequestInit & { fieldMask: string },
): Promise<T> {
  const apiKey = getApiKey();
  const { fieldMask, headers: extraHeaders, ...rest } = init;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fieldMask,
    ...(extraHeaders as Record<string, string> | undefined),
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...rest, headers });
    } catch (err) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(jitter(RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw new PlacesApiError(0, `Network error: ${(err as Error).message}`);
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    const status = res.status;
    const bodyText = await res.text().catch(() => '');
    const retryable = status === 429 || (status >= 500 && status < 600);

    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      const delay = status === 429 ? RETRY_DELAYS_MS[attempt] : jitter(RETRY_DELAYS_MS[attempt]);
      console.warn(`[places] retry ${attempt + 1} after ${delay}ms (HTTP ${status})`);
      await sleep(delay);
      continue;
    }
    throw new PlacesApiError(status, `Places API HTTP ${status}: ${bodyText.slice(0, 300)}`, bodyText);
  }

  throw new PlacesApiError(0, 'placesFetch: unreachable');
}

// ============================================================
// 1. Autocomplete — Hotelier-UI Suggestion-Dropdown
// SKU: Autocomplete (Per Session) — $2.83/1000, 5000 frei/Monat
// ============================================================

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface AutocompleteOptions {
  /** Hotel-Coordinates für Location-Bias (sortiert by distance). */
  lat?: number;
  lng?: number;
  /** Radius in Meter für Location-Bias. Default 50000 (50 km). */
  radius?: number;
  /** Sprach-Code z.B. 'de', 'en'. */
  languageCode?: string;
  /** Google Primary Types Filter — schränkt Ergebnisse auf bestimmte Betriebstypen ein.
   *  Ohne Filter liefert Google auch Städte/Regionen. */
  includedPrimaryTypes?: string[];
}

export async function placesAutocomplete(
  input: string,
  options: AutocompleteOptions = {},
): Promise<PlacePrediction[]> {
  if (!input || input.trim().length < 2) return [];

  const body: Record<string, unknown> = {
    input: input.trim(),
    ...(options.languageCode && { languageCode: options.languageCode }),
  };

  // Location-Bias wenn Hotel-Coordinates da
  if (typeof options.lat === 'number' && typeof options.lng === 'number') {
    body.locationBias = {
      circle: {
        center: { latitude: options.lat, longitude: options.lng },
        radius: Math.max(1, Math.min(50000, options.radius ?? 50000)),
      },
    };
  }

  // Typ-Filter: schränkt auf Establishments ein — verhindert Städte/Regionen in Ergebnissen
  if (options.includedPrimaryTypes && options.includedPrimaryTypes.length > 0) {
    body.includedPrimaryTypes = options.includedPrimaryTypes;
  }

  // SKU: Autocomplete (Per Session) — gratis bis 5000 Sessions/Monat
  const response = await placesFetch<{
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        types?: string[];
      };
    }>;
  }>(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    body: JSON.stringify(body),
    fieldMask: 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types',
  });

  return (response.suggestions ?? [])
    .map(s => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map(p => ({
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? '',
      secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
      types: p.types ?? [],
    }));
}

// ============================================================
// 2. Place Details — Pick-Anzeige + Refresh-Cron
// SKU: Essentials ($5/1000, 10k frei) ODER Atmosphere ($20/1000, 1k frei)
// ============================================================

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  types: string[];
  googleMapsUri: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;  // 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | ...
  websiteUri?: string;
  internationalPhoneNumber?: string;
  /** Array von Photo-Resource-Pfaden (places/X/photos/Y). buildPhotoUrl() macht draus URL. */
  photoNames: string[];
  /** Atmosphere-Felder — nur wenn includeAtmosphere=true. */
  openingHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    publishTime: string;
  }>;
}

const ESSENTIALS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'googleMapsUri',
  'rating',
  'userRatingCount',
  'priceLevel',
  'photos',
].join(',');

const ATMOSPHERE_FIELD_MASK = [
  ESSENTIALS_FIELD_MASK,
  'websiteUri',
  'internationalPhoneNumber',
  'currentOpeningHours.openNow',
  'currentOpeningHours.weekdayDescriptions',
  'reviews',
].join(',');

export interface PlaceDetailsOptions {
  /** Default false (Essentials, $5/1k). True → Atmosphere ($20/1k, 1k frei). */
  includeAtmosphere?: boolean;
  /** Sprach-Code für displayName, weekdayDescriptions, reviews etc. */
  languageCode?: string;
}

export async function getPlaceDetails(
  placeId: string,
  options: PlaceDetailsOptions = {},
): Promise<PlaceDetails> {
  const fieldMask = options.includeAtmosphere ? ATMOSPHERE_FIELD_MASK : ESSENTIALS_FIELD_MASK;
  const url = new URL(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`);
  if (options.languageCode) url.searchParams.set('languageCode', options.languageCode);

  // SKU: Essentials ($5/1000) ODER Atmosphere ($20/1000) — abhängig von Field-Mask
  const raw = await placesFetch<RawPlaceDetails>(url.toString(), {
    method: 'GET',
    fieldMask,
  });

  return normalizePlaceDetails(raw);
}

// ============================================================
// 3. Nearby Search — Auto-Empfehlungen für Hotel-Umgebung
// SKU: Nearby Search Essentials — $5/1000, 10k frei
// ============================================================

export type PickCategory = 'restaurant' | 'cafe' | 'bar' | 'activity' | 'sight';

/** Mapping unserer Kategorien auf Google "primary types". */
const CATEGORY_TYPES: Record<PickCategory, string[]> = {
  restaurant: ['restaurant'],
  cafe:       ['cafe', 'coffee_shop'],
  bar:        ['bar', 'pub', 'wine_bar'],
  activity:   ['tourist_attraction', 'park', 'amusement_park'],
  sight:      ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark'],
};

export interface NearbyResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  userRatingCount?: number;
  photoNames: string[];
}

export interface SearchNearbyOptions {
  /** Radius in Meter (max 50000). Default 1500. */
  radius?: number;
  /** Max Anzahl Results (max 20). Default 20. */
  maxResultCount?: number;
  /** Sprach-Code für displayName/formattedAddress. */
  languageCode?: string;
}

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  category: PickCategory,
  options: SearchNearbyOptions = {},
): Promise<NearbyResult[]> {
  const includedTypes = CATEGORY_TYPES[category];
  if (!includedTypes) throw new Error(`Unknown category: ${category}`);

  const body: Record<string, unknown> = {
    includedTypes,
    maxResultCount: Math.max(1, Math.min(20, options.maxResultCount ?? 20)),
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.max(1, Math.min(50000, options.radius ?? 1500)),
      },
    },
    ...(options.languageCode && { languageCode: options.languageCode }),
    rankPreference: 'POPULARITY',
  };

  // SKU: Nearby Search Essentials — gratis bis 10000/Monat
  const response = await placesFetch<{
    places?: RawPlaceDetails[];
  }>(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    body: JSON.stringify(body),
    fieldMask: 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos,places.location,places.types',
  });

  return (response.places ?? []).map(p => {
    const d = normalizePlaceDetails(p);
    return {
      placeId: d.placeId,
      name: d.name,
      formattedAddress: d.formattedAddress,
      location: d.location,
      types: d.types,
      rating: d.rating,
      userRatingCount: d.userRatingCount,
      photoNames: d.photoNames,
    };
  });
}

// ============================================================
// 4. Photo-URL-Helper — Frontend ruft direkt von Google-CDN ab
// SKU: Photos (Per Request) — $7/1000 — fällt erst beim Frontend-Fetch an
// ============================================================

/**
 * Baut die direkte Photo-URL für Frontend-Fetch.
 *
 * @param photoName z.B. "places/XYZ/photos/ABC" aus PlaceDetails.photoNames
 * @param maxWidthPx max-Breite — Google liefert proportionierte Variante zurück
 *
 * WICHTIG: Der API-Key ist im URL hier — heißt das URL geht an den Frontend!
 * Lösung: HTTP-Referrer-Restriction in der Google Cloud Console aktivieren,
 * damit der Key nur von unseren Domains aus funktioniert.
 */
export function buildPhotoUrl(photoName: string, maxWidthPx: number = 800): string {
  const apiKey = getApiKey();
  const width = Math.max(50, Math.min(4800, Math.floor(maxWidthPx)));
  return `${PLACES_BASE}/${photoName}/media?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`;
}

// ============================================================
// Internal Helpers
// ============================================================

interface RawPlaceDetails {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    publishTime?: string;
  }>;
}

function normalizePlaceDetails(raw: RawPlaceDetails): PlaceDetails {
  return {
    placeId: raw.id ?? '',
    name: raw.displayName?.text ?? '',
    formattedAddress: raw.formattedAddress ?? '',
    location: {
      lat: raw.location?.latitude ?? 0,
      lng: raw.location?.longitude ?? 0,
    },
    types: raw.types ?? [],
    googleMapsUri: raw.googleMapsUri ?? '',
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    priceLevel: raw.priceLevel,
    websiteUri: raw.websiteUri,
    internationalPhoneNumber: raw.internationalPhoneNumber,
    photoNames: (raw.photos ?? []).map(p => p.name).filter((n): n is string => typeof n === 'string'),
    openingHours: raw.currentOpeningHours ? {
      openNow: raw.currentOpeningHours.openNow,
      weekdayDescriptions: raw.currentOpeningHours.weekdayDescriptions,
    } : undefined,
    reviews: raw.reviews?.map(r => ({
      authorName: r.authorAttribution?.displayName ?? 'Anonymous',
      rating: r.rating ?? 0,
      text: r.text?.text ?? '',
      publishTime: r.publishTime ?? '',
    })),
  };
}

export { PlacesApiError };
