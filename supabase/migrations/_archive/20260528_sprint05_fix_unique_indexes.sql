-- Sprint 0+1 · Schritt 5 Hotfix — Unique-Indizes für ON CONFLICT brauchbar machen
-- Stand: 2026-05-28
--
-- Bug: Sprint-2-Migration hat die UNIQUE-Indizes als PARTIAL angelegt
-- (WHERE mews_*_id IS NOT NULL). Das ist semantisch zwar äquivalent zur
-- Verhinderung von Duplikaten unter den Non-NULL-Werten — aber Postgres'
-- `ON CONFLICT (col)` matched partielle Indizes nicht automatisch, und
-- Supabase's `.upsert()` kann die WHERE-Klausel nicht mitgeben.
-- Resultat: "no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Fix: partielle Indizes droppen, durch volle UNIQUE-Indizes ersetzen.
--
-- Sicherheit:
--   - Postgres behandelt NULL-Werte in einem Standard-UNIQUE-Index als
--     DISTINCT (NULLS DISTINCT ist PG-Default). D.h. beliebig viele Rows
--     dürfen mews_*_id = NULL haben — für manuell angelegte Records ohne
--     Mews-Link bleibt der Use-Case intakt.
--   - Jede konkrete Mews-ID kann weiterhin nur einmal pro Tabelle vorkommen.
--   - Tabellen sind nach Sprint-2-Migration leer (TRUNCATE-Block) — kein
--     Risiko durch existierende Duplikate.
--
-- Idempotent: `DROP IF EXISTS` + `CREATE`. Mehrfacher Run = safe.

-- ============================================================
-- guests
-- ============================================================
DROP INDEX IF EXISTS idx_guests_mews_customer;
CREATE UNIQUE INDEX idx_guests_mews_customer
  ON guests(mews_customer_id);

-- ============================================================
-- stays
-- ============================================================
DROP INDEX IF EXISTS idx_stays_mews_reservation;
CREATE UNIQUE INDEX idx_stays_mews_reservation
  ON stays(mews_reservation_id);

-- ============================================================
-- rooms
-- ============================================================
DROP INDEX IF EXISTS idx_rooms_mews_resource;
CREATE UNIQUE INDEX idx_rooms_mews_resource
  ON rooms(mews_resource_id);
