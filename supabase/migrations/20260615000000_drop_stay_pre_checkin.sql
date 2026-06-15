-- Voranmeldungs-Flow entfernt (Mews übernimmt Check-in).
-- Tabelle stay_pre_checkin, Trigger und Funktion werden gelöscht.
-- Abhängigkeiten geprüft: kein anderer Code referenziert diese Tabelle.

drop trigger  if exists set_stay_pre_checkin_updated_at on public.stay_pre_checkin;
drop function if exists public.set_stay_pre_checkin_updated_at();
drop table    if exists public.stay_pre_checkin;
