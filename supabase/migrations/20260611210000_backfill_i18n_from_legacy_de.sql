-- CC-WURZELFIX: Backfill *_i18n from legacy _de columns (DE only).
-- Stale _en/_fr/_es are NOT frozen — auto-translate runs on next backoffice save.
-- Idempotent: only fills rows where _i18n IS NULL and _de IS NOT NULL.

UPDATE hotel_settings
SET breakfast_location_i18n = jsonb_build_object(
  'de', jsonb_build_object(
    'value',      breakfast_location_de,
    'source',     'original',
    'updated_at', now()::text
  )
)
WHERE breakfast_location_i18n IS NULL
  AND breakfast_location_de IS NOT NULL;

UPDATE hotel_settings
SET breakfast_included_i18n = jsonb_build_object(
  'de', jsonb_build_object(
    'value',      breakfast_included_de,
    'source',     'original',
    'updated_at', now()::text
  )
)
WHERE breakfast_included_i18n IS NULL
  AND breakfast_included_de IS NOT NULL;

UPDATE hotel_settings
SET welcome_message_i18n = jsonb_build_object(
  'de', jsonb_build_object(
    'value',      welcome_message_de,
    'source',     'original',
    'updated_at', now()::text
  )
)
WHERE welcome_message_i18n IS NULL
  AND welcome_message_de IS NOT NULL;

UPDATE hotel_settings
SET hotel_eyebrow_i18n = jsonb_build_object(
  'de', jsonb_build_object(
    'value',      hotel_eyebrow_de,
    'source',     'original',
    'updated_at', now()::text
  )
)
WHERE hotel_eyebrow_i18n IS NULL
  AND hotel_eyebrow_de IS NOT NULL;
