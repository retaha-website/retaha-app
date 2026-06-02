-- BRAND-003 — Room ↔ Hotel Isolation Fix
--
-- ROOT-CAUSE (siehe Diagnose-Bericht):
--   Globaler UNIQUE-Index auf rooms(mews_resource_id) erlaubte rooms.upsert mit
--   onConflict='mews_resource_id' beim Sync von mehreren Hotels (selber Mews-
--   Demo-Account, gleiche resource_ids) korrupte Cross-Hotel-Updates.
--   Stays bekamen room_ids von Rooms anderer Hotels.
--
-- FIX (Reihenfolge kritisch):
--   1. UNIQUE-Index auf mews_resource_id loeschen (global)
--   2. Neuer UNIQUE-Index (hotel_id, mews_resource_id) — pro Hotel eindeutig
--   3. Cleanup: 97 Cross-Hotel-Stays auf room_id=NULL setzen
--   4. UNIQUE-Index (id, hotel_id) auf rooms (Composite-FK-Voraussetzung)
--   5. stays.room_id FK → Composite FK auf (room_id, hotel_id)
--      → erzwingt DB-seitig: stays.hotel_id MUSS rooms.hotel_id matchen
--
-- VERIFY am Ende: COUNT(cross-hotel-stays) = 0, FK-Constraints aktiv.
--
-- Re-runnable: IF EXISTS / IF NOT EXISTS pro Step.

BEGIN;

-- ─── 1. Alter globaler UNIQUE-Index DROP ─────────────────────
DROP INDEX IF EXISTS public.idx_rooms_mews_resource;

-- ─── 2. Neuer composite UNIQUE-Index (hotel_id, mews_resource_id) ──
-- Erlaubt onConflict='hotel_id,mews_resource_id' im Sync-Code.
-- WHERE-Klausel: nur Rooms mit gesetzter mews_resource_id (sync-relevant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_hotel_mews_resource
  ON public.rooms (hotel_id, mews_resource_id)
  WHERE mews_resource_id IS NOT NULL;

-- ─── 3. Cleanup: Cross-Hotel-Stays auf room_id=NULL ──────────
-- 97 Stays von Gate Garden Hotel zeigten auf Test-Hotel-1-Rooms.
-- Re-Mapping ist NICHT moeglich (Gate Garden hat 0 eigene Rooms) —
-- room_id=NULL ist der korrekte Zustand bis Sync mit korrekter
-- Mews-Integration neu laeuft.
UPDATE public.stays s
SET room_id = NULL
WHERE EXISTS (
  SELECT 1 FROM public.rooms r
  WHERE r.id = s.room_id
    AND r.hotel_id IS DISTINCT FROM s.hotel_id
);

-- ─── 4. VERIFY (sanity-check, soll 0 sein) ───────────────────
DO $$
DECLARE
  cross_hotel_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cross_hotel_count
  FROM public.stays s
  JOIN public.rooms r ON r.id = s.room_id
  WHERE r.hotel_id IS DISTINCT FROM s.hotel_id;

  IF cross_hotel_count > 0 THEN
    RAISE EXCEPTION 'BRAND-003 cleanup failed: % cross-hotel stays remain', cross_hotel_count;
  END IF;

  RAISE NOTICE 'BRAND-003 cleanup verified: 0 cross-hotel stays';
END $$;

-- ─── 5. Composite-UNIQUE auf rooms (id, hotel_id) ────────────
-- Voraussetzung fuer Composite-FK in Schritt 6.
-- id ist bereits PK (uniq), aber (id, hotel_id) Composite-UNIQUE wird vom FK
-- benoetigt damit Postgres weiss dass die Referenz eindeutig ist.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rooms_id_hotel
  ON public.rooms (id, hotel_id);

-- ─── 6. Composite Foreign Key auf stays(room_id, hotel_id) ────
-- Garantiert DB-seitig: wenn room_id gesetzt ist, MUSS rooms.hotel_id =
-- stays.hotel_id sein. Verhindert zukuenftige Cross-Hotel-Korruption.
-- ON DELETE SET NULL: wenn ein Room geloescht wird (z.B. Hotel-Cleanup),
-- werden die Stays nicht mitgeloescht — sie verlieren nur die room-Referenz.
ALTER TABLE public.stays
  DROP CONSTRAINT IF EXISTS stays_room_id_fkey;

ALTER TABLE public.stays
  ADD CONSTRAINT stays_room_hotel_fkey
  FOREIGN KEY (room_id, hotel_id)
  REFERENCES public.rooms (id, hotel_id)
  ON DELETE SET NULL;

-- ─── 7. Final-Verify: Constraints aktiv + 0 Korruption ───────
DO $$
DECLARE
  cross_hotel_count INTEGER;
  has_fk BOOLEAN;
  has_unique BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO cross_hotel_count
  FROM public.stays s
  JOIN public.rooms r ON r.id = s.room_id
  WHERE r.hotel_id IS DISTINCT FROM s.hotel_id;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stays_room_hotel_fkey'
      AND conrelid = 'public.stays'::regclass
  ) INTO has_fk;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'rooms'
      AND indexname = 'idx_rooms_hotel_mews_resource'
  ) INTO has_unique;

  RAISE NOTICE 'BRAND-003 final-verify: cross_hotel_stays=%, composite_fk=%, hotel_mews_unique=%',
    cross_hotel_count, has_fk, has_unique;
END $$;

COMMIT;
