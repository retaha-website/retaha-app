-- Sprint 0+1 · Schritt 5 Hotfix 3 — rooms.room_number nullable + alten Mock-UNIQUE-Constraint droppen
-- Stand: 2026-05-28
--
-- Bug: Der alte UNIQUE-Constraint `rooms_hotel_id_room_number_key` stammt
-- aus der Mock-Data-Phase. In der Mews-Welt ist `mews_resource_id` der echte
-- Identifier (eigener UNIQUE-Index aus Sprint-5-Hotfix 1). Mews liefert
-- room_number oft gar nicht — nur Name. Mehrere Resources mit identem oder
-- fehlendem room_number → Konflikt beim Sync.
--
-- Fix:
--   1. room_number nullable — Mews-Resources ohne Number bekommen NULL
--      (Postgres behandelt mehrere NULLs in UNIQUE-Indizes als distinct,
--      mehrere leere Strings dagegen NICHT — deshalb explizit NULL)
--   2. alten Constraint droppen — mews_resource_id-UNIQUE-Index aus
--      Sprint-5-Hotfix 1 ist jetzt die Source-of-truth für Eindeutigkeit
--
-- Idempotent: DROP NOT NULL + DROP CONSTRAINT IF EXISTS.

ALTER TABLE rooms ALTER COLUMN room_number DROP NOT NULL;

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_hotel_id_room_number_key;
