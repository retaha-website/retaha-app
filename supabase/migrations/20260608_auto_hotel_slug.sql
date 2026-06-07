-- Migration: Hotel-Slug automatisch aus Hotel-Name generieren
-- Trigger: setzt slug bei INSERT (und bei UPDATE wenn slug leer/null)
-- Fix: bestehende Hotels mit ungültigem/leerem Slug korrigieren

-- ── 1. Funktion: Name → URL-sicherer Slug ────────────────────────────────
CREATE OR REPLACE FUNCTION slugify(input text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Umlaute ersetzen
  result := replace(lower(trim(input)), 'ä', 'ae');
  result := replace(result, 'ö', 'oe');
  result := replace(result, 'ü', 'ue');
  result := replace(result, 'ß', 'ss');
  -- Alles außer a-z, 0-9 → Bindestrich
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  -- Führende/nachfolgende Bindestriche entfernen
  result := trim(both '-' from result);
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 2. Trigger-Funktion: Slug setzen falls leer oder nicht gesetzt ────────
CREATE OR REPLACE FUNCTION set_hotel_slug_from_name()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  candidate text;
  counter   int := 0;
BEGIN
  -- Nur setzen wenn slug leer/null ODER bei neuem Hotel
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    base_slug := slugify(NEW.name);
    candidate := base_slug;

    -- Eindeutigkeit sichern
    WHILE EXISTS (
      SELECT 1 FROM hotels WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    ) LOOP
      counter   := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Trigger anlegen ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_hotel_slug ON hotels;
CREATE TRIGGER trg_hotel_slug
  BEFORE INSERT ON hotels
  FOR EACH ROW EXECUTE FUNCTION set_hotel_slug_from_name();

-- ── 4. Bestehende Hotels mit ungültigem Slug korrigieren ──────────────────
--    Betrifft: slug IS NULL, leer, oder sieht nach auto-generiertem Theme-Namen aus
--    (enthält 'manufaktur', 'anthrazit', 'burgund', endet auf '-prod'/'-dev')
DO $$
DECLARE
  rec       RECORD;
  base_slug text;
  candidate text;
  counter   int;
BEGIN
  FOR rec IN
    SELECT id, name, slug FROM hotels
    WHERE
      slug IS NULL OR
      trim(slug) = '' OR
      slug ~ '(manufaktur|anthrazit|burgund|-prod$|-dev$|-staging$)'
  LOOP
    base_slug := slugify(rec.name);
    candidate := base_slug;
    counter   := 0;

    WHILE EXISTS (
      SELECT 1 FROM hotels WHERE slug = candidate AND id != rec.id
    ) LOOP
      counter   := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;

    UPDATE hotels SET slug = candidate WHERE id = rec.id;
    RAISE NOTICE 'Hotel % (%) → slug: %', rec.name, rec.id, candidate;
  END LOOP;
END $$;
