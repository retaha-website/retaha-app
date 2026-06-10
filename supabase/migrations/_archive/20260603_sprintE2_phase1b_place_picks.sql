-- Sprint E2 · Phase 1b — Hotelier-kuratierte Place-Picks mit Google-Reference
-- Erstellt: 2026-06-03
--
-- Hotelier wählt via Autocomplete Places aus, ergänzt mit Hotel-Notiz (i18n).
-- cached_data hält Google-Place-Details (Atmosphere-Felder) — Refresh-Cron
-- aktualisiert monatlich (Briefing Phase 5). photo_references als Array
-- damit Frontend direkt von Google-CDN lädt ohne extra Cache.

CREATE TABLE IF NOT EXISTS hotel_place_picks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,

  place_id     TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('restaurant', 'cafe', 'bar', 'activity', 'sight')),

  -- Hotelier-Notiz (Premium-Detail) in 4 Sprachen
  hotel_note    TEXT,
  hotel_note_en TEXT,
  hotel_note_fr TEXT,
  hotel_note_es TEXT,

  -- Cache der Google-Place-Details + Photo-References
  cached_data       JSONB,
  photo_references  TEXT[],

  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  last_refresh TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(hotel_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_hotel_place_picks_hotel_category
  ON hotel_place_picks(hotel_id, category, is_published, sort_order);

CREATE INDEX IF NOT EXISTS idx_hotel_place_picks_refresh
  ON hotel_place_picks(last_refresh)
  WHERE is_published = true;

ALTER TABLE hotel_place_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "place_picks: hotel owner read"   ON hotel_place_picks;
DROP POLICY IF EXISTS "place_picks: hotel owner insert" ON hotel_place_picks;
DROP POLICY IF EXISTS "place_picks: hotel owner update" ON hotel_place_picks;
DROP POLICY IF EXISTS "place_picks: hotel owner delete" ON hotel_place_picks;

CREATE POLICY "place_picks: hotel owner read"
  ON hotel_place_picks FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "place_picks: hotel owner insert"
  ON hotel_place_picks FOR INSERT
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "place_picks: hotel owner update"
  ON hotel_place_picks FOR UPDATE
  USING (hotel_id IN (SELECT user_hotel_ids()))
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "place_picks: hotel owner delete"
  ON hotel_place_picks FOR DELETE
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE hotel_place_picks IS
  'Sprint E2 — Hotelier-kuratierte Empfehlungen mit Google-Place-Reference. cached_data wird monatlich via Cron refreshed.';
COMMENT ON COLUMN hotel_place_picks.place_id IS
  'Google Places ID (z.B. "ChIJ..."). UNIQUE pro Hotel — kein Hotel pickt das gleiche Place zweimal.';
COMMENT ON COLUMN hotel_place_picks.cached_data IS
  'JSONB von Google getPlaceDetails: name, rating, user_ratings_total, price_level, types, opening_hours, website, phone, reviews (top 3), location, google_maps_url, formatted_address.';
COMMENT ON COLUMN hotel_place_picks.photo_references IS
  'Array von Photo-References — Frontend baut die URL direkt für CDN-Fetch (kein extra API-Call von uns).';
