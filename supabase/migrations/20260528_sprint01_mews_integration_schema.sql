-- Sprint 0+1 · Schritt 2 — Mews-Integration Schema-Migration
-- Stand: 2026-05-28
--
-- Erweitert stays/guests/rooms/bookings um Mews-IDs + Sync-Felder, legt neue
-- mews_integrations-Tabelle an. Alle ALTER-Statements sind idempotent
-- (IF NOT EXISTS), der TRUNCATE-Block ist mit Sicherheits-Check geschützt:
-- wenn bereits Mews-Daten vorhanden sind, wird übersprungen.
--
-- Entscheidungen siehe ANTWORTEN_SPRINT_1_KLAERUNG.md:
-- - Bestehende Tabellen ERWEITERN (nicht neu anlegen)
-- - check_in/check_out auf TIMESTAMPTZ (Mews liefert UTC)
-- - stays.access_token bleibt unverändert (Gast-Token-Mechanismus)
-- - breakfast_items NICHT truncaten (Hotel-Konfiguration)

-- ============================================================
-- BLOCK 1 — Sicherheits-Spalte zuerst, damit Block 2 prüfen kann
-- ============================================================
ALTER TABLE stays ADD COLUMN IF NOT EXISTS mews_reservation_id TEXT;

-- ============================================================
-- BLOCK 2 — Mock-Daten truncate (nur wenn noch keine Mews-Daten drin)
-- ============================================================
-- Sicherheits-Check: wenn auch nur EIN stay mit mews_reservation_id existiert,
-- ist der erste Sync schon gelaufen — wir truncaten dann NICHT mehr.
DO $$
DECLARE
  has_mews_data boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM stays WHERE mews_reservation_id IS NOT NULL LIMIT 1
  ) INTO has_mews_data;

  IF NOT has_mews_data THEN
    -- Reihenfolge wegen FK: bookings hängt an stays
    TRUNCATE TABLE bookings CASCADE;
    TRUNCATE TABLE stays CASCADE;
    TRUNCATE TABLE guests CASCADE;
    TRUNCATE TABLE rooms CASCADE;
    RAISE NOTICE 'Mock-Daten getruncated (keine Mews-Daten gefunden)';
  ELSE
    RAISE NOTICE 'Truncate übersprungen: Mews-Daten bereits vorhanden';
  END IF;
END
$$;

-- ============================================================
-- BLOCK 3 — stays: Typ-Wechsel + restliche Mews-Felder
-- ============================================================

-- DATE → TIMESTAMPTZ (Tabelle ist nach Truncate leer, also gefahrlos)
-- Falls Spalte schon TIMESTAMPTZ ist: kein No-Op-Statement in PG, daher in DO-Block
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stays'
      AND column_name = 'check_in' AND data_type = 'date'
  ) THEN
    ALTER TABLE stays ALTER COLUMN check_in TYPE TIMESTAMPTZ USING check_in::timestamptz;
    ALTER TABLE stays ALTER COLUMN check_out TYPE TIMESTAMPTZ USING check_out::timestamptz;
    RAISE NOTICE 'stays.check_in/check_out konvertiert: DATE → TIMESTAMPTZ';
  ELSE
    RAISE NOTICE 'stays.check_in ist bereits TIMESTAMPTZ — kein Typ-Wechsel nötig';
  END IF;
END
$$;

ALTER TABLE stays ADD COLUMN IF NOT EXISTS mews_customer_id TEXT;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS raw_mews_data JSONB;

-- Unique-Constraint auf mews_reservation_id (verhindert Duplikate beim Sync)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stays_mews_reservation
  ON stays(mews_reservation_id) WHERE mews_reservation_id IS NOT NULL;

-- Index für aktive Stays (Check-out-Logik, Wallet-Trigger)
CREATE INDEX IF NOT EXISTS idx_stays_active
  ON stays(hotel_id) WHERE checked_out_at IS NULL;

-- ============================================================
-- BLOCK 4 — guests
-- ============================================================
ALTER TABLE guests ADD COLUMN IF NOT EXISTS mews_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_mews_customer
  ON guests(mews_customer_id) WHERE mews_customer_id IS NOT NULL;

-- ============================================================
-- BLOCK 5 — rooms
-- ============================================================
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mews_resource_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_mews_resource
  ON rooms(mews_resource_id) WHERE mews_resource_id IS NOT NULL;

-- ============================================================
-- BLOCK 6 — bookings
-- ============================================================
-- type/status/stay_id/details existieren bereits.
-- mews_order_id für späteres "Charge to Room"-Tracking (Sprint 5).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mews_order_id TEXT;

-- ============================================================
-- BLOCK 7 — mews_integrations (neue Tabelle)
-- ============================================================
CREATE TABLE IF NOT EXISTS mews_integrations (
  hotel_id              UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  enterprise_id         TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  environment           TEXT NOT NULL DEFAULT 'demo'
    CHECK (environment IN ('demo', 'production')),
  last_sync_at          TIMESTAMPTZ,
  sync_status           TEXT DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error_message    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mews_integrations ENABLE ROW LEVEL SECURITY;

-- Policy idempotent: drop+create damit Re-Runs sauber bleiben
DROP POLICY IF EXISTS "hotel_users_view_own_integration" ON mews_integrations;
CREATE POLICY "hotel_users_view_own_integration"
  ON mews_integrations FOR SELECT
  USING (hotel_id IN (
    SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()
  ));

-- Hotel-Owner darf seine Integration auch schreiben (für Token-Update,
-- Sync-Status-Reset etc. via Backoffice-UI in Sprint 6).
DROP POLICY IF EXISTS "hotel_users_modify_own_integration" ON mews_integrations;
CREATE POLICY "hotel_users_modify_own_integration"
  ON mews_integrations FOR ALL
  USING (hotel_id IN (
    SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid() AND role = 'owner'
  ))
  WITH CHECK (hotel_id IN (
    SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid() AND role = 'owner'
  ));

COMMENT ON TABLE mews_integrations IS
  'Mews-PMS-Integration pro Hotel. access_token_encrypted via AES-256-GCM mit ENV-Key (src/lib/encryption.ts). Sprint 0+1.';
