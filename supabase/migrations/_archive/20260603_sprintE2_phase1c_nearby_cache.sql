-- Sprint E2 · Phase 1c — Nearby-Search-Cache für Auto-Empfehlungen
-- Erstellt: 2026-06-03
--
-- Pro Hotel + Category eine Row mit ~15-20 cached Places aus
-- places.searchNearby (Essentials-SKU = gratis bis 10k Calls). Refresh
-- monatlich via Cron (Briefing Phase 6). Service-Role schreibt, Hotelier-
-- Members lesen.

CREATE TABLE IF NOT EXISTS hotel_place_nearby_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('restaurant', 'cafe', 'bar', 'activity', 'sight')),

  cached_places JSONB NOT NULL,

  last_refresh  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(hotel_id, category)
);

CREATE INDEX IF NOT EXISTS idx_nearby_cache_hotel
  ON hotel_place_nearby_cache(hotel_id);
CREATE INDEX IF NOT EXISTS idx_nearby_cache_refresh
  ON hotel_place_nearby_cache(last_refresh);

ALTER TABLE hotel_place_nearby_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nearby_cache: hotel owner read" ON hotel_place_nearby_cache;

-- Read: alle Hotel-Members. Writes laufen ausschließlich via Service-Role
-- (Cron + initial-build) — daher keine INSERT/UPDATE/DELETE-Policies nötig.
CREATE POLICY "nearby_cache: hotel owner read"
  ON hotel_place_nearby_cache FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE hotel_place_nearby_cache IS
  'Sprint E2 — Auto-Empfehlungs-Cache pro Hotel+Kategorie. Service-Role-Writes via monatlichem Cron, Hotelier-Read.';
COMMENT ON COLUMN hotel_place_nearby_cache.cached_places IS
  'JSONB-Array von ~15-20 Places mit minimaler Field-Mask: place_id, name, address, rating, photo_reference, location, types. Frontend zeigt direkt, Eve liest als Auto-Ergänzung.';
