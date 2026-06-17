-- Self-Checkout-Modus + Gast-Hinweis pro Hotel.
--
-- Master-Schalter bleibt features.self_checkout (true/false). Wenn aktiv, waehlt
-- self_checkout_mode zwischen vollem Self-Checkout ('self') und reiner Info-
-- Anzeige ohne Auscheck-Button ('info'). self_checkout_note: i18n-Gast-Hinweis
-- (z.B. Schluesselrueckgabe, Late-Checkout auf Anfrage).
--
-- Additiv (ADD COLUMN ... NOT NULL DEFAULT) → Bestandszeilen werden mit 'self'
-- bzw. '{}' befuellt; nicht-destruktiv/reversibel.

alter table public.hotel_settings
  add column if not exists self_checkout_mode text not null default 'self',
  add column if not exists self_checkout_note jsonb not null default '{}'::jsonb;

alter table public.hotel_settings
  drop constraint if exists hotel_settings_self_checkout_mode_check;
alter table public.hotel_settings
  add constraint hotel_settings_self_checkout_mode_check
  check (self_checkout_mode in ('self', 'info'));

comment on column public.hotel_settings.self_checkout_mode is 'Self-Checkout-Modus wenn features.self_checkout aktiv: self = voller Flow, info = nur Hinweise (kein Auscheck-Button).';
comment on column public.hotel_settings.self_checkout_note is 'i18n-Gast-Hinweis fuer den Checkout-Screen (z.B. Schluesselrueckgabe), {de, en, ...}.';
