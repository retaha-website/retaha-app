-- Add per-weekday breakfast hours to hotel_settings
ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS breakfast_hours jsonb;

-- Backfill: set all 7 days from existing global start/end for hotels that have them
UPDATE hotel_settings
SET breakfast_hours = jsonb_build_object(
  'mon', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'tue', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'wed', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'thu', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'fri', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'sat', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false),
  'sun', jsonb_build_object('start', COALESCE(LEFT(breakfast_start_time::text, 5), '07:30'), 'end', COALESCE(LEFT(breakfast_end_time::text, 5), '10:30'), 'closed', false)
)
WHERE breakfast_hours IS NULL
  AND (breakfast_start_time IS NOT NULL OR breakfast_end_time IS NOT NULL);
