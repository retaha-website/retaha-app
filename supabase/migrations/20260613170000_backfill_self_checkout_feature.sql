-- Backfill: self_checkout-Feature-Key für bestehende Hotels ergänzen
--
-- Hintergrund: Der Key wurde bei der Phase-1-Bereinigung (36→26 Keys) als
-- vermeintliches Artefakt entfernt. Das Modul ist funktional vollständig und
-- gehört ab sofort ins Pro-Paket (vererbt auf Premium + Enterprise).
--
-- Logik:
--   Pro / Premium / Enterprise  → true  (Modul war vorher aktiv, wird wiederhergestellt)
--   Lite                        → false (nicht im Paket)
--   Nur wo der Key noch fehlt (IS NULL im JSONB) — vorhandene Werte werden NICHT überschrieben.

UPDATE hotel_settings hs
SET features = hs.features || jsonb_build_object(
  'self_checkout',
  h.plan IN ('pro', 'premium', 'enterprise')
)
FROM hotels h
WHERE hs.hotel_id = h.id
  AND (hs.features ->> 'self_checkout') IS NULL;
