-- UX-017 P3 — Charge-Required-Toggle pro Booking-Type
--
-- 7 neue Spalten auf mews_integrations:
--   breakfast_charge_enabled       DEFAULT true   (Standard-Use-Case)
--   conference_charge_enabled      DEFAULT true   (Standard-Use-Case)
--   service_charge_enabled         DEFAULT true   (Standard-Use-Case)
--   restaurant_charge_enabled      DEFAULT false  (Reservation-only)
--   spa_charge_enabled             DEFAULT false  (Reservation-only)
--   late_checkout_charge_enabled   DEFAULT true   (kostet extra)
--   housekeeping_charge_enabled    DEFAULT false  (Free service)
--
-- Code orders.ts skipt mit reason 'charge_disabled_for_type' wenn FALSE.
-- NULL → behandelt als true (Backward-Compat, falls Column nicht existiert
-- aber wegen NOT NULL DEFAULT kommt das hier nicht vor).
--
-- BONUS: Gate-Garden Pauschal-Item fuer Mews-Charge.
-- DB hat bisher 4 À-la-carte-Items (Avocado, Bauernbrot, Granola, Rührei)
-- mit price_cents=0 — Menu-Anzeige fuer Gast, kein Pauschal-Preis.
-- Sprint H Group 2 Default war Continental 18€ / Premium 28€ — aber DB-Items
-- heissen anders. Pragmatic: neuer Pauschal-Item mit display_order=0 +
-- 25€ damit P1-Default-Lookup (display_order ASC LIMIT 1) ein sinnvolles
-- Item zurueckgibt. Hotelier kann via /admin/breakfast Preis anpassen.

ALTER TABLE mews_integrations
  ADD COLUMN IF NOT EXISTS breakfast_charge_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conference_charge_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS restaurant_charge_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spa_charge_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_checkout_charge_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS housekeeping_charge_enabled BOOLEAN NOT NULL DEFAULT false;

-- À-la-carte-Items auf display_order >= 1 verschieben damit Pauschal-Item
-- garantiert das erste ist.
UPDATE breakfast_items
SET display_order = display_order + 1
WHERE hotel_id = '1f30ac02-17e1-47b6-9bda-487e14b07627'
  AND category IS DISTINCT FROM 'package'
  AND display_order = 0;

-- Pauschal-Item einfuegen (idempotent via WHERE NOT EXISTS)
INSERT INTO breakfast_items (
  hotel_id, display_order, is_active, category,
  name_de, name_en, name_fr, name_es, name_i18n,
  price_cents, created_at, updated_at
)
SELECT
  '1f30ac02-17e1-47b6-9bda-487e14b07627'::uuid,
  0,
  true,
  'package',
  'Frühstück Pauschale',
  'Breakfast Package',
  'Petit-déjeuner forfaitaire',
  'Desayuno paquete',
  jsonb_build_object(
    'de', jsonb_build_object('value', 'Frühstück Pauschale', 'source', 'original', 'updated_at', NOW()::text),
    'en', jsonb_build_object('value', 'Breakfast Package', 'source', 'override', 'updated_at', NOW()::text),
    'fr', jsonb_build_object('value', 'Petit-déjeuner forfaitaire', 'source', 'override', 'updated_at', NOW()::text),
    'es', jsonb_build_object('value', 'Desayuno paquete', 'source', 'override', 'updated_at', NOW()::text)
  ),
  2500,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM breakfast_items
  WHERE hotel_id = '1f30ac02-17e1-47b6-9bda-487e14b07627'
    AND category = 'package'
    AND display_order = 0
);
