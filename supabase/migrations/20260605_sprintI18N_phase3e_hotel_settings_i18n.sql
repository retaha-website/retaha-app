-- Sprint i18n-Expansion Phase 3e — hotel_settings → i18n-JSONB
--
-- 4 Plain-Spalten-Sets bekommen jeweils ein _i18n-Pendant:
--   welcome_message, hotel_eyebrow, breakfast_location, breakfast_included
--
-- Plus IN-PLACE-Migration der 2 JSONB-Array-Spalten conference_rooms +
-- service_items: deren Items haben das gleiche _de/_en/_fr/_es-Pattern auf
-- name + description Felder. Die Daten-Migration im Node-Script transformiert
-- jedes Item zu zusätzlich name_i18n + description_i18n (alte Felder bleiben
-- als Safety-Net im selben JSONB-Item).
--
-- Phase 10 Cleanup: alte _de/_en/_fr/_es-Spalten droppen + JSONB-Item-Cleanup.

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS welcome_message_i18n JSONB,
  ADD COLUMN IF NOT EXISTS hotel_eyebrow_i18n JSONB,
  ADD COLUMN IF NOT EXISTS breakfast_location_i18n JSONB,
  ADD COLUMN IF NOT EXISTS breakfast_included_i18n JSONB;

CREATE INDEX IF NOT EXISTS idx_hotel_settings_welcome_i18n
  ON hotel_settings USING GIN (welcome_message_i18n);

COMMENT ON COLUMN hotel_settings.welcome_message_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt welcome_message_de/en/fr/es.';
COMMENT ON COLUMN hotel_settings.hotel_eyebrow_i18n IS
  'Sprint i18n: I18nValue JSONB. Ersetzt hotel_eyebrow_de/en/fr/es.';
COMMENT ON COLUMN hotel_settings.breakfast_location_i18n IS
  'Sprint i18n: I18nValue JSONB. Ersetzt breakfast_location_de/en/fr/es.';
COMMENT ON COLUMN hotel_settings.breakfast_included_i18n IS
  'Sprint i18n: I18nValue JSONB. Ersetzt breakfast_included_de/en/fr/es.';
