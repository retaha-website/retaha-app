-- Sprint E2 · Phase 1a — Hotels Schema-Erweiterung für Places-Nearby-Search
-- Erstellt: 2026-06-03
--
-- Phase-0-Discovery: hotels.city + hotels.country existieren bereits, aber
-- street, zip, lat/lng fehlen. Lat/lng sind Pflicht für searchNearbyPlaces.
-- city + country bleiben unverändert.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_zip    TEXT,
  ADD COLUMN IF NOT EXISTS latitude       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude      DOUBLE PRECISION;

COMMENT ON COLUMN hotels.address_street IS
  'Straße + Hausnummer für Geocoding + Hotelier-Anzeige. NULL bis Hotelier sie setzt.';
COMMENT ON COLUMN hotels.address_zip IS
  'PLZ für Geocoding + Address-Display. NULL bis Hotelier sie setzt.';
COMMENT ON COLUMN hotels.latitude IS
  'Geocoded Latitude (z.B. via Nominatim aus street+zip+city). Pflicht für places.searchNearby.';
COMMENT ON COLUMN hotels.longitude IS
  'Geocoded Longitude. Pflicht für places.searchNearby.';
