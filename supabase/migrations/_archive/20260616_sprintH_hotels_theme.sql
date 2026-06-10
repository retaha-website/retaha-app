-- Sprint H · Group 1 — Hotel-Themes
--
-- 3 retaha-Themes auswählbar pro Hotel via hotels.theme.
-- Default 'bauhaus_manufaktur' (= aktueller Pink-Shock-Look).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'bauhaus_manufaktur'
  CHECK (theme IN ('bauhaus_manufaktur', 'premium_anthrazit', 'warmes_burgund'));

COMMENT ON COLUMN hotels.theme IS
  'Sprint H Group 1: visuelles Theme — bauhaus_manufaktur (default, Pink-Shock), premium_anthrazit (Gold-Akzent), warmes_burgund (Burgundy + Serif).';
