-- Sprint-J: Settings Refactor — neue Hotel-Felder
-- /settings Seite: Hotel-Identität, Adresse & Kontakt, Geschäftsdaten,
--                  Rechnungsadresse, Team-Sicherheit

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS classification       text
    CHECK (classification IN ('3','4','4s','5','boutique')),
  ADD COLUMN IF NOT EXISTS hotel_type           text
    CHECK (hotel_type IN ('city','resort','wellness','business','boutique')),
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS email                text,
  ADD COLUMN IF NOT EXISTS website              text,
  -- Geschäftsdaten
  ADD COLUMN IF NOT EXISTS legal_form           text,
  ADD COLUMN IF NOT EXISTS company_name         text,
  ADD COLUMN IF NOT EXISTS commercial_register  text,
  ADD COLUMN IF NOT EXISTS vat_id               text,
  ADD COLUMN IF NOT EXISTS tax_number           text,
  -- Rechnungsadresse
  ADD COLUMN IF NOT EXISTS billing_recipient    text,
  ADD COLUMN IF NOT EXISTS billing_email        text,
  ADD COLUMN IF NOT EXISTS billing_street       text,
  ADD COLUMN IF NOT EXISTS billing_zip          text,
  ADD COLUMN IF NOT EXISTS billing_city         text,
  ADD COLUMN IF NOT EXISTS billing_country      text DEFAULT 'DE',
  -- Team-Sicherheit
  ADD COLUMN IF NOT EXISTS session_timeout_hours integer DEFAULT 4;

-- RLS: Owner/Manager dürfen Hotel-Settings updaten
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hotels' AND policyname = 'settings_update_owner_manager'
  ) THEN
    CREATE POLICY "settings_update_owner_manager" ON hotels
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND hotel_id = hotels.id
            AND role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
