-- ============================================================
-- Phase 7 KORRIGIERT: rec-* Migration in JSONB-Array
-- Erstellt: 2026-05-26
--
-- Recommendations leben in hotel_settings.recommendations als JSONB-Array.
-- Jedes Element hat ein 'card_class' Feld.
--
-- Plus: hotel_settings.accent_color Schema-Default ändern.
-- ============================================================

-- 1. Discovery: Welche card_class Werte gibt es aktuell?
SELECT
  hotel_id,
  jsonb_array_length(recommendations) as anzahl_karten,
  (SELECT array_agg(elem->>'card_class')
   FROM jsonb_array_elements(recommendations) elem) as card_classes
FROM hotel_settings
WHERE jsonb_array_length(recommendations) > 0;

-- 2. JSONB-Migration: card_class-Werte updaten
UPDATE hotel_settings
SET recommendations = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'card_class' = 'rec-burgund'
        THEN jsonb_set(elem, '{card_class}', '"rec-pink"')
      WHEN elem->>'card_class' = 'rec-bone'
        THEN jsonb_set(elem, '{card_class}', '"rec-white"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(recommendations) elem
)
WHERE recommendations @> '[{"card_class": "rec-burgund"}]'::jsonb
   OR recommendations @> '[{"card_class": "rec-bone"}]'::jsonb;

-- 3. Verify: sollte 0 rec-burgund + 0 rec-bone übrig sein, rec-anthrazit bleibt
SELECT
  hotel_id,
  (SELECT array_agg(elem->>'card_class')
   FROM jsonb_array_elements(recommendations) elem) as card_classes
FROM hotel_settings
WHERE jsonb_array_length(recommendations) > 0;

-- 4. accent_color Schema-Default für NEUE Hotels umstellen
-- (Bestehende Hotels behalten ihre individuelle Farbe — Entscheidung Phase 5)
ALTER TABLE public.hotel_settings
  ALTER COLUMN accent_color SET DEFAULT '#FF4A82';

-- 5. Verify: Default sollte jetzt #FF4A82 sein
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'hotel_settings'
  AND column_name  = 'accent_color';

-- ============================================================
-- ROLLBACK (im Notfall):
-- ============================================================
-- UPDATE hotel_settings
-- SET recommendations = (
--   SELECT jsonb_agg(
--     CASE
--       WHEN elem->>'card_class' = 'rec-pink'
--         THEN jsonb_set(elem, '{card_class}', '"rec-burgund"')
--       WHEN elem->>'card_class' = 'rec-white'
--         THEN jsonb_set(elem, '{card_class}', '"rec-bone"')
--       ELSE elem
--     END
--   )
--   FROM jsonb_array_elements(recommendations) elem
-- )
-- WHERE recommendations @> '[{"card_class": "rec-pink"}]'::jsonb
--    OR recommendations @> '[{"card_class": "rec-white"}]'::jsonb;
--
-- ALTER TABLE public.hotel_settings
--   ALTER COLUMN accent_color SET DEFAULT '#8C2128';
