// Sprint E2 · Phase 3 — Geocoding via Nominatim (OpenStreetMap, gratis)
//
// Nominatim-Limits:
//   · max 1 Request / Sekunde global pro IP
//   · User-Agent Header verpflichtend mit Kontakt-Info
//   · keine kommerzielle Bulk-Geocoding-Nutzung
//
// Pattern: in-memory queue mit 1100ms delay zwischen Requests garantiert
// dass wir die 1 Req/Sek nicht überschreiten. Für Hotelier-Setup (1-2 Calls
// pro Hotel-Anmeldung) total ausreichend.
//
// Backlog: Fallback auf Google Geocoding API ($5/1000) falls Nominatim für
// neue/exotische Adressen oft failt. Aktuell: einfach + gratis.

let lastCallTime = 0;
const MIN_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastCallTime = Date.now();
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Normalisierte Adresse die Nominatim zurückgeliefert hat — kann der UI als Bestätigung angezeigt werden. */
  display_name: string;
}

/**
 * Geocodet eine Adress-Zeile zu lat/lng via Nominatim.
 *
 * Returnt null wenn nicht gefunden oder Network-Fehler. Niemals throw —
 * Hotelier-Setup soll nicht crashen wenn Adresse nicht auflösbar ist.
 *
 * @example
 *   const r = await geocodeAddress('Hardenbergstraße 4, 10623 Berlin, DE');
 *   // { lat: 52.5063, lng: 13.3239, display_name: 'Hardenbergstraße 4, ...' }
 */
export async function geocodeAddress(addressQuery: string): Promise<GeocodeResult | null> {
  const trimmed = addressQuery.trim();
  if (trimmed.length < 5) return null;

  await rateLimitWait();

  const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'retaha-app/1.0 (info@retaha.de)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[geocoding] Nominatim HTTP ${res.status} für "${trimmed}"`);
      return null;
    }
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const top = data[0];
    const lat = parseFloat(top.lat);
    const lng = parseFloat(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, display_name: top.display_name };
  } catch (err) {
    console.warn(`[geocoding] Nominatim fetch failed für "${trimmed}":`, (err as Error).message);
    return null;
  }
}

/**
 * Helper: baut Adress-Query-String aus den hotels-Spalten.
 *
 * Format: "Street, ZIP City, Country" — was Nominatim am verlässlichsten parst.
 */
export function buildAddressQuery(parts: {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const line1 = parts.street?.trim();
  const line2 = [parts.zip?.trim(), parts.city?.trim()].filter(Boolean).join(' ');
  const line3 = parts.country?.trim();
  return [line1, line2, line3].filter(Boolean).join(', ');
}
