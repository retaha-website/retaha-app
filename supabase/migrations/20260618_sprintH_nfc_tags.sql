-- Sprint H · Group 3 — NFC-Tags
--
-- Hotelier verwaltet NFC-Tags die Gäste auf physische Karten programmieren.
-- 4 Target-Typen:
--   guest_stay    — fester Stay-Token im target_value.stay_id
--   hotel_general — dynamisch: aktiver Stay > Showcase > /n/welcome
--   room          — Lookup stays.room_id → rooms.room_number = target_value.room_number
--   custom_url    — beliebige https-URL
--
-- Programmier-QR-Pattern: Hotelier schreibt URL https://app.retaha.de/n/<id>
-- per NFC-Writer-App (z.B. "NFC Tools") auf Holzkarte.

CREATE TABLE IF NOT EXISTS nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  tag_uid TEXT UNIQUE,                       -- physische NFC-Chip-ID (optional)
  label TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('guest_stay', 'hotel_general', 'room', 'custom_url')),
  target_value JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scan_count INT NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_tags_hotel ON nfc_tags(hotel_id, is_active);

CREATE OR REPLACE FUNCTION set_nfc_tags_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nfc_tags_updated_at ON nfc_tags;
CREATE TRIGGER nfc_tags_updated_at BEFORE UPDATE ON nfc_tags
  FOR EACH ROW EXECUTE FUNCTION set_nfc_tags_updated_at();

ALTER TABLE nfc_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read nfc_tags" ON nfc_tags;
CREATE POLICY "Hotel members read nfc_tags"
  ON nfc_tags FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE nfc_tags IS
  'Sprint H Group 3: NFC-Tag-Verwaltung. Programmier-QR-Pattern (kein direkter Web-NFC-Write).';

-- ─── Atomic-Scan-RPC ──────────────────────────────────────────────────
-- Single-Query: erhöht scan_count + setzt last_scanned_at + returnt
-- Routing-Daten. Race-frei via UPDATE..RETURNING.

CREATE OR REPLACE FUNCTION nfc_scan(p_tag_id UUID)
RETURNS TABLE (
  id UUID,
  hotel_id UUID,
  target_type TEXT,
  target_value JSONB
) AS $$
BEGIN
  RETURN QUERY
  UPDATE nfc_tags
  SET scan_count = nfc_tags.scan_count + 1,
      last_scanned_at = NOW()
  WHERE nfc_tags.id = p_tag_id AND nfc_tags.is_active = true
  RETURNING nfc_tags.id, nfc_tags.hotel_id, nfc_tags.target_type, nfc_tags.target_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nfc_scan IS
  'Sprint H Group 3: atomic scan_count++ + last_scanned_at + returnt Routing-Target. SECURITY DEFINER fuer Gast-anonym-Aufrufe.';

-- ─── Demo-Tags für Gate Garden Hotel Berlin ──────────────────────────
-- Pre-fill damit Kristin sofort sehen kann wie Tags funktionieren

DO $$
DECLARE gate_garden_id UUID := '1f30ac02-17e1-47b6-9bda-487e14b07627';
BEGIN
  -- Idempotent: nur einfügen wenn noch keine Demo-Tags für dieses Hotel
  IF NOT EXISTS (SELECT 1 FROM nfc_tags WHERE hotel_id = gate_garden_id LIMIT 1) THEN
    INSERT INTO nfc_tags (hotel_id, label, target_type, target_value) VALUES
      (gate_garden_id, 'Lobby · Empfang',         'hotel_general', NULL),
      (gate_garden_id, 'Showcase · Demo-Karte',   'hotel_general', NULL),
      (gate_garden_id, 'Zimmer 101',              'room',          jsonb_build_object('room_number', '101')),
      (gate_garden_id, 'Zimmer 102',              'room',          jsonb_build_object('room_number', '102')),
      (gate_garden_id, 'Restaurant · Tisch 5',    'custom_url',    jsonb_build_object('url', 'https://www.google.com/maps/place/The+Gate+Garden+Hotel+Berlin'));
  END IF;
END $$;
