// Sprint E2 · Phase 7 — Haversine-Distance + Walking-Time-Estimate
//
// Backlog: Google Directions API für genaue Walking-Time. Aktuell Haversine
// + Annahme 80m/min = 4.8 km/h Walking-Pace.

const EARTH_RADIUS_M = 6_371_000;
const WALKING_METERS_PER_MINUTE = 80;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function walkingMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return Math.max(1, Math.round(meters / WALKING_METERS_PER_MINUTE));
}
