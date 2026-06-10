-- Sprint C · Phase 3 — pricing_mode für orders/add Gross/Net-Switch
-- ========================================================================
-- Mews-Enterprise hat Pricing="Gross" oder "Net" (aus configuration/get).
-- Bei Gross → orders/add Items.UnitAmount.GrossValue (Brutto). Bei Net →
-- NetValue (Netto, Mews rechnet die Steuer drauf).
--
-- Idempotent. Bestehende rows bleiben NULL bis nächster Connect — der
-- Connect-Flow in pms.astro speichert pricing_mode dann automatisch.
-- Für das Demo-Hotel setzt das parallele Script scripts/sprint-c-set-defaults.ts
-- 'Gross' direkt, plus default_tax_code='UK-2022-20%'.
-- ========================================================================

ALTER TABLE mews_integrations
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mews_integrations_pricing_mode_check'
  ) THEN
    ALTER TABLE mews_integrations
      ADD CONSTRAINT mews_integrations_pricing_mode_check
      CHECK (pricing_mode IS NULL OR pricing_mode IN ('Gross', 'Net'));
  END IF;
END $$;

COMMENT ON COLUMN mews_integrations.pricing_mode IS
  'Aus Mews configuration.Enterprise.Pricing: "Gross" → UnitAmount.GrossValue, "Net" → UnitAmount.NetValue. NULL = noch nicht synct (alte Row vor Sprint C Phase 3). Wird beim Connect automatisch befüllt.';
