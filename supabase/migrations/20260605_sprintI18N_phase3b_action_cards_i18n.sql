-- Sprint i18n-Expansion Phase 3b — hotel_action_cards → i18n-JSONB
--
-- 4 Felder: title, subtitle, eyebrow, cta — alle bekommen _i18n-Variante.
-- title_de bleibt NOT NULL (alte Pflicht), die anderen waren bereits nullable.
-- Alte _de/_en/_fr/_es-Spalten bleiben bis Phase 10 Cleanup.

ALTER TABLE hotel_action_cards
  ADD COLUMN IF NOT EXISTS title_i18n JSONB,
  ADD COLUMN IF NOT EXISTS subtitle_i18n JSONB,
  ADD COLUMN IF NOT EXISTS eyebrow_i18n JSONB,
  ADD COLUMN IF NOT EXISTS cta_i18n JSONB;

CREATE INDEX IF NOT EXISTS idx_action_cards_title_i18n
  ON hotel_action_cards USING GIN (title_i18n);

COMMENT ON COLUMN hotel_action_cards.title_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt title_de/en/fr/es. Phase 10 droppt alte Spalten.';
