-- Marker: Eve wurde aus der Hotel-Website auto-geseedet (einmalig beim ersten
-- Onboarding-Login). Verhindert Mehrfach-Läufe des Auto-Scrape. Der manuelle
-- „Aus Website lernen"-Button ist davon unabhängig. Routine-additiv.

alter table public.hotels
  add column if not exists eve_seeded boolean not null default false;

comment on column public.hotels.eve_seeded is
  'true = Eve-Wissen wurde automatisch aus der Website geseedet (einmalig). Manueller Re-Scrape bleibt möglich.';