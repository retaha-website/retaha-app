-- Migration: 3 Design-Identitäten (bauhaus / editorial / maison)
-- Phase: Guest 3 Themes
-- Deployment: mit Phase 7 (Produktions-Migration)

-- 1. classic → bauhaus (sicherer Default)
UPDATE hotels
SET design_identity = 'bauhaus'
WHERE design_identity = 'classic' OR design_identity IS NULL;

-- 2. Constraint auf neue 3 Identitäten anpassen
ALTER TABLE hotels
DROP CONSTRAINT IF EXISTS hotels_design_identity_check;

ALTER TABLE hotels
ADD CONSTRAINT hotels_design_identity_check
CHECK (design_identity IN ('bauhaus', 'editorial', 'maison'));

-- 3. Default-Wert = bauhaus
ALTER TABLE hotels
ALTER COLUMN design_identity SET DEFAULT 'bauhaus';

-- 4. Showcase-Sessions: theme_override Spalte
ALTER TABLE showcase_sessions
ADD COLUMN IF NOT EXISTS theme_override text
CONSTRAINT showcase_theme_override_check
CHECK (theme_override IN ('bauhaus', 'editorial', 'maison'));

-- 5. 3 Test-Showcase-Sessions für Taha (Kristin's Hotel)
-- hotel_id = '1f30ac02-17e1-47b6-9bda-487e14b07627'
-- Token-Prefix 'showcase_' + 32 hex-chars (statisch für Tests)
INSERT INTO showcase_sessions (hotel_id, token, theme_override, expires_at, demo_data)
VALUES
  ('1f30ac02-17e1-47b6-9bda-487e14b07627',
   'showcase_3theme_bauhaus_000000000000',
   'bauhaus',
   now() + interval '30 days',
   '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Bauhaus Suite"}'::jsonb),

  ('1f30ac02-17e1-47b6-9bda-487e14b07627',
   'showcase_3theme_editorial_00000000000',
   'editorial',
   now() + interval '30 days',
   '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Editorial Suite"}'::jsonb),

  ('1f30ac02-17e1-47b6-9bda-487e14b07627',
   'showcase_3theme_maison_0000000000000',
   'maison',
   now() + interval '30 days',
   '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Maison Suite"}'::jsonb)
ON CONFLICT (token) DO NOTHING;

-- Verifikation
SELECT name, design_identity FROM hotels WHERE id = '1f30ac02-17e1-47b6-9bda-487e14b07627';
SELECT token, theme_override, expires_at FROM showcase_sessions
WHERE hotel_id = '1f30ac02-17e1-47b6-9bda-487e14b07627'
  AND token LIKE 'showcase_3theme_%';
