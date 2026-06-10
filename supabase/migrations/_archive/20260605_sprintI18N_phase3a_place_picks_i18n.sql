-- Sprint i18n-Expansion Phase 3a — hotel_place_picks → i18n-JSONB
--
-- Mini-Step A (kleinste Tabelle, etabliert das Migration-Pattern):
-- hotel_note (DE) + hotel_note_en/fr/es → hotel_note_i18n JSONB
--
-- I18nValue-Format (siehe src/lib/i18n/types.ts):
--   { "de": { "value": "...", "source": "original", "updated_at": "..." },
--     "en": { "value": "...", "source": "override", "updated_at": "..." } }
--
-- Bestehende DE-Texte: source='original' (vom Hotelier in seiner Default-Sprache eingegeben)
-- Bestehende EN/FR/ES: source='override' (manuell vom Hotelier befüllt → ÜBERSCHREIBEN
--                                        zukünftige Auto-Translations, nicht von Phase-6-
--                                        Hook angefasst)
--
-- Safety-Net-Strategie: alte Spalten hotel_note, hotel_note_en/fr/es BLEIBEN.
-- Phase 10 Cleanup droppt sie nach Production-Verifikation.

ALTER TABLE hotel_place_picks
  ADD COLUMN IF NOT EXISTS hotel_note_i18n JSONB;

CREATE INDEX IF NOT EXISTS idx_place_picks_note_i18n
  ON hotel_place_picks USING GIN (hotel_note_i18n);

COMMENT ON COLUMN hotel_place_picks.hotel_note_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt hotel_note + hotel_note_en/fr/es. '
  'Alte Spalten bleiben bis Phase 10 als Safety-Net.';
