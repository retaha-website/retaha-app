-- Sprint 0+1 · Schritt 5 Hotfix 2 — stays.room_id + guest_id nullable
-- Stand: 2026-05-28
--
-- Bug: Das alte stays-Schema (aus der Mock-Data-Phase vor Mews) hat room_id
-- und vermutlich auch guest_id als NOT NULL. Mews-Reservations können
-- aber legitim:
--   - kein zugewiesenes Zimmer haben (AssignedResourceId = null)
--   - einen Company-Account statt Customer haben (kein guest-Link)
-- Beides ist normal und vom Briefing erlaubt.
--
-- Fix: NOT NULL auf beiden FKs droppen.
--
-- Idempotent: ALTER COLUMN ... DROP NOT NULL kracht nicht wenn die Spalte
-- schon nullable ist (PG-no-op).
--
-- Sicherheit: ändert nur das Constraint, keine Daten-Migration. Existing
-- Rows (Tabelle ist eh leer nach Sprint-2-Truncate) bleiben unverändert.

ALTER TABLE stays ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE stays ALTER COLUMN guest_id DROP NOT NULL;
