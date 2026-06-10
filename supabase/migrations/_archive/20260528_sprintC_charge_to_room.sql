-- Sprint C · Charge-to-Room Foundation
-- ========================================================================
-- Erweitert mews_integrations um Mews-Order-Konfiguration (Service-Mapping,
-- Tax/Currency-Defaults, Pricing-Source-Toggle), ergänzt Preis-Felder in
-- den Modul-Tabellen (breakfast_items + JSONB service_items/conference_rooms)
-- und Push-Logging in bookings.
--
-- Alle Statements idempotent (IF NOT EXISTS / Pattern-Matching). Mehrfach-
-- Ausführung tut nicht weh.
-- ========================================================================


-- ────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — mews_integrations: Order-Konfiguration
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE mews_integrations
  ADD COLUMN IF NOT EXISTS pricing_source TEXT NOT NULL DEFAULT 'retaha',
  ADD COLUMN IF NOT EXISTS default_currency TEXT,
  ADD COLUMN IF NOT EXISTS default_tax_code TEXT,
  ADD COLUMN IF NOT EXISTS service_id_breakfast TEXT,
  ADD COLUMN IF NOT EXISTS service_id_service TEXT,
  ADD COLUMN IF NOT EXISTS service_id_conference TEXT,
  ADD COLUMN IF NOT EXISTS mews_products_count INTEGER NOT NULL DEFAULT 0;

-- Check constraint separat (ADD COLUMN ... CHECK ... ist nicht idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mews_integrations_pricing_source_check'
  ) THEN
    ALTER TABLE mews_integrations
      ADD CONSTRAINT mews_integrations_pricing_source_check
      CHECK (pricing_source IN ('retaha', 'mews'));
  END IF;
END $$;

COMMENT ON COLUMN mews_integrations.pricing_source IS
  'Pfad A (retaha): Preise aus retaha-DB, Push als Custom Items. Pfad C+ (mews): Preise aus Mews-Products via ProductOrders. Sprint C startet mit Pfad A; Pfad C+ ist Stub (NotImplementedError).';
COMMENT ON COLUMN mews_integrations.default_currency IS
  'ISO-Code aus configuration.Enterprise.Currencies (IsDefault=true). Wird beim Connect befüllt.';
COMMENT ON COLUMN mews_integrations.default_tax_code IS
  'Tax-Code für orders/add Items.UnitAmount.TaxCodes. Erst NULL — iterativ durch ersten Test-Order ermittelt (Demo: UK-S/V/Z; DE: später).';
COMMENT ON COLUMN mews_integrations.service_id_breakfast IS
  'Mews-Service-Id (Type=Orderable) auf den breakfast-Bookings als Order gepushed werden. Hotelier-Setup.';
COMMENT ON COLUMN mews_integrations.mews_products_count IS
  'Anzahl Products in Mews (aus products/getAll beim Connect). 0 = Pfad C+ disabled in UI.';


-- ────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — Preise: breakfast_items + service_items/conference_rooms (jsonb)
-- ────────────────────────────────────────────────────────────────────────

-- 2a. breakfast_items: dedizierte Spalte
ALTER TABLE breakfast_items
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN breakfast_items.price_cents IS
  'Brutto-Preis pro Item in cents (Gross-Pricing-Konvention). Wird 1:1 in Mews-Order.Items[].UnitAmount.NetValue (cents/100) gepushed.';

-- 2b. hotel_settings.conference_rooms (jsonb array): jedes Element bekommt price_cents_per_hour
UPDATE hotel_settings
SET conference_rooms = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN room ? 'price_cents_per_hour' THEN room
        ELSE room || jsonb_build_object('price_cents_per_hour', 0)
      END
    )
    FROM jsonb_array_elements(conference_rooms) AS room
  ),
  conference_rooms
)
WHERE jsonb_typeof(conference_rooms) = 'array'
  AND jsonb_array_length(conference_rooms) > 0;

-- 2c. hotel_settings.service_items (jsonb array): jedes Element bekommt price_cents
UPDATE hotel_settings
SET service_items = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN item ? 'price_cents' THEN item
        ELSE item || jsonb_build_object('price_cents', 0)
      END
    )
    FROM jsonb_array_elements(service_items) AS item
  ),
  service_items
)
WHERE jsonb_typeof(service_items) = 'array'
  AND jsonb_array_length(service_items) > 0;


-- ────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — bookings: Push-Logging-Felder
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS mews_push_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mews_push_error TEXT;

COMMENT ON COLUMN bookings.mews_push_attempted_at IS
  'Wann pushBookingToMews() zuletzt aufgerufen wurde (Erfolg oder Fehler). NULL = noch nie versucht.';
COMMENT ON COLUMN bookings.mews_push_error IS
  'Fehler-Message des letzten Push-Versuchs. NULL bei Erfolg (mews_order_id ist dann gesetzt) oder vor erstem Versuch.';

-- Bestehende Spalte mews_order_id (TEXT, NULL-able) ist aus Sprint 1 da
-- (20260528_sprint01_mews_integration_schema.sql:106) — kein Touch nötig.


-- ────────────────────────────────────────────────────────────────────────
-- OPTIONAL · Demo-Preise (manuell ausführen falls gewünscht)
-- ────────────────────────────────────────────────────────────────────────
-- Für den E2E-Test können die folgenden UPDATEs Demo-Preise setzen.
-- Auskommentiert lassen — der Hotelier wird die Preise später über UI pflegen.
--
-- UPDATE breakfast_items SET price_cents = 1500 WHERE price_cents = 0;
--
-- UPDATE hotel_settings SET conference_rooms = (
--   SELECT jsonb_agg(room || jsonb_build_object('price_cents_per_hour', 5000))
--   FROM jsonb_array_elements(conference_rooms) AS room
-- ) WHERE jsonb_typeof(conference_rooms) = 'array';
--
-- UPDATE hotel_settings SET service_items = (
--   SELECT jsonb_agg(item || jsonb_build_object('price_cents', 2000))
--   FROM jsonb_array_elements(service_items) AS item
-- ) WHERE jsonb_typeof(service_items) = 'array';
