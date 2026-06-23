-- Plan-Modell + explizites Trial-Ende (finale Spec).
--   plan: lite | pro | premium | enterprise (Default lite = generische Ein-QR-Mappe).
--   trial_ends_at: Trial aktiv solange now() < trial_ends_at (Pro + Eve, 14 Tage).
-- trial_started_at existiert bereits. Routine-additiv (neuer Enum-Typ + Spalten).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hotel_plan') then
    create type public.hotel_plan as enum ('lite', 'pro', 'premium', 'enterprise');
  end if;
end
$$;

alter table public.hotels
  add column if not exists plan public.hotel_plan not null default 'lite',
  add column if not exists trial_ends_at timestamptz;

comment on column public.hotels.plan is
  'Abrechnungsplan: lite (generisch, 1 QR, Eve aus) | pro (zimmerspezifisch, Eve an) | premium | enterprise.';
comment on column public.hotels.trial_ends_at is
  'Trial-Ende (Pro + Eve). Trial aktiv solange now() < trial_ends_at. NULL = kein Trial.';
