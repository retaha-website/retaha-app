-- Sprint i18n-Expansion Phase 3c — breakfast_items → i18n-JSONB
--
-- Im Sprint-Briefing nicht erwähnt, in Phase-0-Discovery aber gefunden.
-- Migration parallel zu den anderen Tabellen — Konsistenz.
--
-- 2 Felder: name (NOT NULL DE), description (nullable). Alte Spalten bleiben.

ALTER TABLE breakfast_items
  ADD COLUMN IF NOT EXISTS name_i18n JSONB,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB;

CREATE INDEX IF NOT EXISTS idx_breakfast_items_name_i18n
  ON breakfast_items USING GIN (name_i18n);

COMMENT ON COLUMN breakfast_items.name_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt name_de/en/fr/es. Phase 10 droppt alte Spalten.';
