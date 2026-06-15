-- Service-Zeiten pro Wochentag (1:1 nach Muster 20260612014108_breakfast_weekday_hours).
-- Backfill aus bestehenden Einzelzeiten für alle vorhandenen Zeilen.

alter table public.hotel_settings
  add column if not exists service_hours jsonb;

update public.hotel_settings
set service_hours = (
  select jsonb_object_agg(d, jsonb_build_object(
    'start',  to_char(coalesce(service_start_time, time '07:00'), 'HH24:MI'),
    'end',    to_char(coalesce(service_end_time,   time '22:00'), 'HH24:MI'),
    'closed', false
  ))
  from unnest(array['mon','tue','wed','thu','fri','sat','sun']) as d
)
where service_hours is null;
