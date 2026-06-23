-- Onboarding-Flow „Du bist live" abgeschlossen? (pro Hotel / Account)
-- Steuert, ob das Setup auf /uebersicht erneut erscheint. Wird durch den Klick
-- auf „Mach's komplett" gesetzt (POST /api/admin/onboarding/complete).
-- Routine-additiv: neue boolesche Spalte mit Default, non-destruktiv.

alter table public.hotels
  add column if not exists onboarding_done boolean not null default false;

comment on column public.hotels.onboarding_done is
  'Onboarding-Flow auf /uebersicht abgeschlossen (per „Mach''s komplett"). Steuert, ob das Setup erneut erscheint.';
