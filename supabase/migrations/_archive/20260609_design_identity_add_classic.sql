-- classic zurück in den Constraint aufnehmen (wurde versehentlich entfernt)
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_design_identity_check;

ALTER TABLE hotels
  ADD CONSTRAINT hotels_design_identity_check
  CHECK (design_identity IN ('classic', 'bauhaus', 'editorial', 'maison'));

-- Showcase theme_override ebenfalls classic erlauben (Konsistenz)
ALTER TABLE showcase_sessions
  DROP CONSTRAINT IF EXISTS showcase_theme_override_check;

ALTER TABLE showcase_sessions
  ADD CONSTRAINT showcase_theme_override_check
  CHECK (theme_override IN ('classic', 'bauhaus', 'editorial', 'maison'));
