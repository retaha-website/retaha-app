-- Migration: 3 Design-Identitäten (bauhaus / editorial / maison)
-- Phase: Guest 3 Themes

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

-- 5. Test-Sessions: nur einfügen wenn Hotel existiert
--    (hotel_id wird dynamisch aus hotels-Tabelle gelesen → kein FK-Fehler)
DO $$
DECLARE
  v_hotel_id uuid;
BEGIN
  -- Erstes aktives Hotel verwenden (oder NULL → kein INSERT)
  SELECT id INTO v_hotel_id FROM hotels LIMIT 1;

  IF v_hotel_id IS NOT NULL THEN
    INSERT INTO showcase_sessions (hotel_id, token, theme_override, expires_at, demo_data)
    VALUES
      (v_hotel_id,
       'showcase_3theme_bauhaus_000000000000',
       'bauhaus',
       now() + interval '30 days',
       '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Bauhaus Suite"}'::jsonb),

      (v_hotel_id,
       'showcase_3theme_editorial_00000000000',
       'editorial',
       now() + interval '30 days',
       '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Editorial Suite"}'::jsonb),

      (v_hotel_id,
       'showcase_3theme_maison_0000000000000',
       'maison',
       now() + interval '30 days',
       '{"guest_first_name":"Maximilian","guest_last_name":"Test","room_number":"204","room_name":"Maison Suite"}'::jsonb)
    ON CONFLICT (token) DO UPDATE
      SET theme_override = EXCLUDED.theme_override,
          expires_at     = EXCLUDED.expires_at;
  END IF;
END $$;
