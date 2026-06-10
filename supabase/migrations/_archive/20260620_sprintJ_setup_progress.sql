-- Sprint J · Backoffice-Übersicht V9
-- Fügt setup_progress-Spalte zur hotels-Tabelle hinzu.
-- Wert 0–100, repräsentiert den Onboarding-Fortschritt (Stages: 0/30/71/100).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS setup_progress integer DEFAULT 0
  CHECK (setup_progress >= 0 AND setup_progress <= 100);

-- Kommentar für Dokumentation
COMMENT ON COLUMN hotels.setup_progress IS
  'Onboarding-Fortschritt 0–100. Stages: 0=Start, 30=Hotel+Branding, 71=+Module+PMS+2FA, 100=komplett';

-- Pilot The Gate Garden auf 71% (Demo-Stand für Kristin)
UPDATE hotels
  SET setup_progress = 71
  WHERE id = '1f30ac02-17e1-47b6-9bda-487e14b07627';
