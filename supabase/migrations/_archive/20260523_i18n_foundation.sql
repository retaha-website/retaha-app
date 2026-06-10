-- Sub-Phase 6.A: i18n-Foundation
-- Hotel-Setting für Gäste-Anrede (Du/Sie) — wird im Gast-Frontend für tGuest() genutzt.
--
-- User-Locale (Backoffice-Sprache) wandert NICHT als Spalte hierher —
-- sie lebt in auth.users.raw_user_meta_data->>'locale' (Supabase-User-Metadata,
-- über client.auth.updateUser({ data: { locale: 'en' } }) gesetzt).
-- Validation passiert im t()-Helper, kein CHECK-Constraint auf DB-Ebene.

ALTER TABLE hotel_settings
  ADD COLUMN guest_address_form VARCHAR(3) NOT NULL DEFAULT 'sie'
  CHECK (guest_address_form IN ('du', 'sie'));
