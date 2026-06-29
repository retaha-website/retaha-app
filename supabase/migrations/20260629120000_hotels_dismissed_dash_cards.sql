-- Geparkte Dashboard-Feature-Karten account-wide (statt localStorage pro Gerät).
-- Beim Wegklicken (X) im Dashboard wird die Karte hier gespeichert und erscheint
-- als geparkte Benachrichtigung — auf allen Geräten desselben Accounts.
-- Routine-additiv: neue Spalte mit Default, keine Datenänderung.

alter table public.hotels
  add column if not exists dismissed_dash_cards text[] not null default '{}';

comment on column public.hotels.dismissed_dash_cards is
  'Im Dashboard weggeklickte Feature-Karten (z.B. {nfc,eve}) → account-wide geparkte Benachrichtigung.';
