-- Migration: Design-Identität für Hotels
-- 3 Design-Identitäten ersetzen die 3 Farb-Themes (classic/bauhaus/editorial)

-- 1. Spalte hinzufügen mit 'bauhaus' als Default für neue Hotels
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS design_identity text DEFAULT 'bauhaus'
    CHECK (design_identity IN ('classic', 'bauhaus', 'editorial'));

-- 2. Bestehende Hotels (die schon brand_theme gesetzt haben) bekommen 'classic'
--    damit kein Visual-Shock entsteht
UPDATE hotels
SET design_identity = 'classic'
WHERE design_identity IS NULL
   OR (brand_theme IN ('coffee', 'ocean', 'forest', 'custom') AND design_identity = 'bauhaus');

-- 3. Sicherstellen: kein NULL-Wert
UPDATE hotels SET design_identity = 'classic' WHERE design_identity IS NULL;
