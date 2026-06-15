-- Add per-weekday service hours to hotel_settings (same pattern as breakfast_hours).
ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS service_hours jsonb;

-- Backfill: set all 7 days from existing global start/end for hotels that have them.
UPDATE hotel_settings
SET service_hours = jsonb_build_object(
  'mon', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'tue', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'wed', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'thu', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'fri', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'sat', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false),
  'sun', jsonb_build_object('start', COALESCE(LEFT(service_start_time::text, 5), '08:00'), 'end', COALESCE(LEFT(service_end_time::text, 5), '22:00'), 'closed', false)
)
WHERE service_hours IS NULL;

-- NOTE: Seed-Items werden über die /service-items Backoffice-Seite eingetragen.
-- Die hotel_id c827efae-7343-4979-90e7-3d44fbcc266a war falsch (FK-Fehler).
-- Kein Seed-INSERT hier — Taha trägt die Items manuell via Backoffice ein.
