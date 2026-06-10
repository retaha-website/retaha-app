-- Brand-Vereinfachung: Sekundärfarbe entfernen.
-- Alle Palette-Rollen werden deterministisch aus brand_primary abgeleitet.
ALTER TABLE hotels DROP COLUMN IF EXISTS brand_secondary;
