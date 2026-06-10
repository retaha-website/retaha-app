-- Migration: 3 neue Design-Identitäten
-- bauhaus, editorial, maison (classic bleibt als Legacy-Option)
-- showcase_sessions.theme_override für Test-Sessions

-- 1. Constraint auf hotels.design_identity erweitern (classic behalten!)
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_design_identity_check;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_design_identity_check
  CHECK (design_identity IN ('classic', 'bauhaus', 'editorial', 'maison'));

-- Default auf bauhaus setzen (falls noch keiner gesetzt)
ALTER TABLE hotels
  ALTER COLUMN design_identity SET DEFAULT 'bauhaus';

-- 2. showcase_sessions.theme_override Spalte (für Test-Sessions pro Theme)
ALTER TABLE showcase_sessions
  ADD COLUMN IF NOT EXISTS theme_override text
  CHECK (theme_override IN ('classic', 'bauhaus', 'editorial', 'maison'));

-- 3. Constraint auf showcase_sessions.theme_override (falls schon existiert, neu setzen)
ALTER TABLE showcase_sessions
  DROP CONSTRAINT IF EXISTS showcase_theme_override_check;

ALTER TABLE showcase_sessions
  ADD CONSTRAINT showcase_theme_override_check
  CHECK (theme_override IN ('classic', 'bauhaus', 'editorial', 'maison'));
