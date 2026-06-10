-- Sprint D · Phase 3 — Statischer room_code für Holzkarten-QR/NFC
-- ========================================================================
-- Jedes Zimmer bekommt einen 8-Zeichen base32 room_code, der auf einer
-- physischen Holzkarte (NFC + QR) im Zimmer steht. Route /g/r/[room_code]
-- resolviert über Cookie-Pairing auf den aktuellen Stay.
--
-- Format: 8 Zeichen aus base32-Alphabet ohne ähnlich aussehende (0/O, 1/I).
-- Konkret: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 Zeichen, Crockford-Variante).
-- ⇒ Entropy: 32^8 ≈ 1.1 × 10^12 — eindeutig genug für Hotels mit << 1M Zimmer.
--
-- room_code ist statisch nach Generation. UNIQUE GLOBAL (nicht pro Hotel),
-- damit /g/r/[room_code] ohne Hotel-Disambiguation funktioniert.
-- ========================================================================

-- 1) Generator-Funktion (idempotent)
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    END LOOP;

    -- Collision-Check
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_code) THEN
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'room_code collision after 10 attempts — extremely unlikely';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_room_code() IS
  '8-Zeichen base32 (Crockford-Variante ohne 0/O/1/I) mit Collision-Retry. Wird beim Insert neuer Räume + als Backfill für existierende Zeilen verwendet.';


-- 2) Spalte hinzufügen (zunächst nullable für Backfill)
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_code TEXT;


-- 3) Backfill für existierende Räume
UPDATE rooms
SET room_code = generate_room_code()
WHERE room_code IS NULL;


-- 4) NOT NULL + UNIQUE + Default für künftige INSERTs
ALTER TABLE rooms
  ALTER COLUMN room_code SET NOT NULL,
  ALTER COLUMN room_code SET DEFAULT generate_room_code();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rooms_room_code_unique'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_room_code_unique UNIQUE (room_code);
  END IF;
END $$;

COMMENT ON COLUMN rooms.room_code IS
  '8-Zeichen base32 (Crockford-Variante ohne 0/O/1/I), eindeutig global. Wird auf physischer Holzkarte (NFC + QR) im Zimmer hinterlegt. Route /g/r/[room_code] löst via Cookie-Pairing auf aktuellen Stay auf. Statisch nach Generation.';
