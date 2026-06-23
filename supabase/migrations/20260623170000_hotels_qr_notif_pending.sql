-- QR-/NFC-Bestell-Benachrichtigung pro Account (DB statt nur localStorage).
-- Wird nach „Mach's komplett" gesetzt und im Benachrichtigungs-Drawer + an den
-- Punkten (Avatar/Dropdown) serverseitig gerendert → zuverlässig, cross-device.
-- Routine-additiv.

alter table public.hotels
  add column if not exists qr_notif_pending boolean not null default false;

comment on column public.hotels.qr_notif_pending is
  'Offene QR-/NFC-Bestell-Benachrichtigung (nach Onboarding-Abschluss). true = im Benachrichtigungs-Drawer anzeigen.';
