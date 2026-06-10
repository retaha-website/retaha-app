-- Theme ist hotel-level only. hotel.design_identity ist die einzige Source of Truth.
-- showcase_sessions.theme_override war eine fehlerhafte Doppelquelle — wird entfernt.

-- 1. Spalte entfernen
ALTER TABLE showcase_sessions
  DROP COLUMN IF EXISTS theme_override;

-- 2. Platzhalter-Test-Tokens löschen (nicht echte Architektur)
DELETE FROM showcase_sessions
  WHERE token LIKE 'showcase_3theme_%'
     OR token LIKE '%_000000000000';
