-- „Setup übersprungen"-Marker pro Account. Wird gesetzt, wenn der Hotelier den
-- Onboarding-Flow überspringt ohne ihn abzuschließen → erzeugt im Benachrichtigungs-
-- Drawer den Hinweis „Setup noch nicht vollständig". Beim Abschluss wieder false.
-- Routine-additiv.

alter table public.hotels
  add column if not exists setup_skipped boolean not null default false;

comment on column public.hotels.setup_skipped is
  'true = Onboarding wurde übersprungen, aber nicht abgeschlossen → „Setup unvollständig"-Benachrichtigung anzeigen. Beim Abschluss (onboarding_done) wieder false.';