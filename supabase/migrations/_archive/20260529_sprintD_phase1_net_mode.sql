-- Sprint D · Phase 1 — Net-Pricing-Mode Support
-- ========================================================================
-- Net-Pricing-Hotels (z.B. DE-Hotels wie Gate Garden) brauchen für orders/add
-- den NetValue, nicht GrossValue. Berechnung: Net = Gross / (1 + tax_rate_value).
-- Dafür müssen wir den numerischen Rate-Wert pro Hotel cachen (TaxCode allein
-- reicht nicht — Mews ignoriert TaxEnvironmentCodes-Filter, wir können nicht
-- "live aus dem TaxCode den Rate ableiten" ohne taxations/getAll-Call).
--
-- Spalte ist nullable: Hotelier muss bei Net-Mode-Setup im Backoffice den
-- Tax-Code speichern → der save_config-Handler löst taxations/getAll-Lookup
-- aus und befüllt default_tax_rate automatisch.
--
-- NUMERIC(5,4) Bereich: -9.9999 bis +9.9999 → ausreichend für VAT-Sätze.
-- ========================================================================

ALTER TABLE mews_integrations
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mews_integrations_default_tax_rate_check'
  ) THEN
    ALTER TABLE mews_integrations
      ADD CONSTRAINT mews_integrations_default_tax_rate_check
      CHECK (default_tax_rate IS NULL OR (default_tax_rate >= 0 AND default_tax_rate < 1));
  END IF;
END $$;

COMMENT ON COLUMN mews_integrations.default_tax_rate IS
  'Numerischer Tax-Rate-Wert für default_tax_code (z.B. 0.19 für DE-19%, 0.20 für UK-Standard). Wird beim Save des Tax-Codes im /admin/pms via taxations/getAll-Lookup automatisch befüllt. NULL → Net-Pricing-Mode wirft PushSkipped(no_default_tax_rate).';
