-- Remove 'classic' from hotels.design_identity constraint.
-- Requires 20260608_three_themes_migrate_classic.sql to have run first
-- (all classic rows already migrated to bauhaus).

ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_design_identity_check;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_design_identity_check
  CHECK (design_identity IN ('bauhaus', 'editorial', 'maison'));

-- Same cleanup for showcase_sessions.theme_override
ALTER TABLE showcase_sessions
  DROP CONSTRAINT IF EXISTS showcase_theme_override_check;

ALTER TABLE showcase_sessions
  ADD CONSTRAINT showcase_theme_override_check
  CHECK (theme_override IN ('bauhaus', 'editorial', 'maison'));
