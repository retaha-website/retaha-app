-- Sprint Functional Modul A Phase 1 — hotel_users für Multi-User erweitern
--
-- DISCOVERY-BEFUND: Tabelle heißt hotel_users (nicht user_hotels wie im
-- Briefing geraten). Schema hat role-Spalte schon mit DEFAULT 'owner' —
-- alle 11 bestehenden Einträge sind 'owner', also KEINE Daten-Migration nötig.
--
-- Phase 1 reduziert sich auf:
--   1. CHECK-Constraint auf role (war bisher freier TEXT)
--   2. 3 neue Spalten für Invite-Audit (invited_by, invited_at, accepted_at)
--
-- Alle bestehenden Rows sind 'owner' und haben accepted_at=NULL — wir
-- backfillen accepted_at=created_at damit der UI-Filter "offene Einladungen"
-- nicht alle bestehenden User als "noch nicht akzeptiert" zeigt.

ALTER TABLE hotel_users
  DROP CONSTRAINT IF EXISTS check_hotel_users_role;
ALTER TABLE hotel_users
  ADD CONSTRAINT check_hotel_users_role
    CHECK (role IN ('owner', 'manager', 'staff'));

ALTER TABLE hotel_users
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Backfill: bestehende User haben sich nie via Magic-Link "akzeptiert"
-- (das Konzept gab's vorher nicht). accepted_at = created_at damit sie
-- als "aktiv" zählen statt als "offene Einladung".
UPDATE hotel_users
SET accepted_at = created_at
WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_users_hotel_pending
  ON hotel_users(hotel_id) WHERE accepted_at IS NULL;

COMMENT ON COLUMN hotel_users.role IS
  'Sprint Functional: owner (Vollzugriff) | manager (Settings+Operations) | staff (Operations).';
COMMENT ON COLUMN hotel_users.invited_by IS
  'User, der die Einladung ausgesprochen hat. NULL bei pre-Sprint-Functional Einträgen.';
COMMENT ON COLUMN hotel_users.accepted_at IS
  'Zeitpunkt der Magic-Link-Bestätigung. NULL = offene Einladung (UI-Filter).';
