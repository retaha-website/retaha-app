-- ===================================================================
-- Phase 7: rec-burgund/rec-bone Migration
-- Erstellt: 2026-05-26
-- Zweck: DB-Werte für CSS-Klassen-Namen auf neue DNA umstellen
--
-- SAFE-PROPERTY: CSS hat bereits beide Klassen-Varianten (Schritt 1).
-- Während dieser Migration sind Karten zu jedem Zeitpunkt sichtbar.
-- ===================================================================

-- 1. Backup-Check: aktuelle Verteilung anschauen
SELECT card_class, COUNT(*) as cnt
FROM public.recommendations
GROUP BY card_class
ORDER BY cnt DESC;

-- 2. UPDATE durchführen
UPDATE public.recommendations
SET card_class = CASE
  WHEN card_class = 'rec-burgund' THEN 'rec-pink'
  WHEN card_class = 'rec-bone'    THEN 'rec-white'
  ELSE card_class
END
WHERE card_class IN ('rec-burgund', 'rec-bone');

-- 3. Verify: sollte 0 rec-burgund + 0 rec-bone übrig sein
SELECT card_class, COUNT(*) as cnt
FROM public.recommendations
GROUP BY card_class
ORDER BY cnt DESC;

-- 4. Optional: Default-Constraint im Schema ändern
-- Prüfen ob ein DEFAULT auf der Spalte gesetzt ist:
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'recommendations'
  AND column_name  = 'card_class';

-- Falls DEFAULT 'rec-bone' existiert, ändern auf 'rec-white':
-- ALTER TABLE public.recommendations
--   ALTER COLUMN card_class SET DEFAULT 'rec-white';

-- 5. Optional: CHECK-Constraint anpassen falls vorhanden
-- Constraint anschauen:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.recommendations'::regclass;
--
-- Bei Bedarf: Constraint droppen, UPDATE laufen, neuen Constraint:
-- ALTER TABLE public.recommendations
--   DROP CONSTRAINT IF EXISTS recommendations_card_class_check;
-- (UPDATE oben laufen lassen)
-- ALTER TABLE public.recommendations
--   ADD CONSTRAINT recommendations_card_class_check
--   CHECK (card_class IN ('rec-pink', 'rec-white', 'rec-anthrazit'));
