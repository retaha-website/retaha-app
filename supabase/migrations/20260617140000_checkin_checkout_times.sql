-- Konfigurierbare Check-in-/Checkout-Zeiten pro Hotel.
--
-- Spiegelt das bestehende time-Spalten-Muster in hotel_settings
-- (breakfast_*_time, service_*_time, conference_*_time, eve_online_until):
-- Typ `time without time zone`, mit Default. Additiv → ADD COLUMN ... DEFAULT
-- befüllt bestehende Zeilen automatisch (nicht-destruktiv, reversibel).
--
-- checkout_time treibt ab jetzt die Self-Checkout-Verfügbarkeit (zeitbewusstes
-- Gate: öffnet am Vorabend, schließt checkout_time + Grace) sowie die Anzeige.
-- checkin_time ist das Gegenstück für Pre-Arrival-Anzeige / Templates.
-- Branchen-Defaults: Checkout 11:00, Check-in 15:00.

alter table public.hotel_settings
  add column if not exists checkin_time  time without time zone default '15:00:00',
  add column if not exists checkout_time time without time zone default '11:00:00';

comment on column public.hotel_settings.checkin_time  is 'Standard-Check-in-Zeit des Hotels (Hotel-TZ).';
comment on column public.hotel_settings.checkout_time is 'Standard-Checkout-Zeit (Hotel-TZ); treibt Self-Checkout-Verfügbarkeit + Anzeige.';
