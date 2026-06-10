-- Sprint D · Phase 2 — Notifications-Mini-MVP
-- ========================================================================
-- Email-Adresse(n) des Hoteliers für Booking-Notifications. Singular-Spalte
-- für jetzt — wenn Hannah + Kirstin parallel benachrichtigt werden wollen,
-- können sie ihre Adressen comma-separated eintragen (der Sender splittet).
--
-- NULL → keine Notification verschickt (Best-Effort: Booking läuft trotzdem
-- durch, console.warn statt error).
-- ========================================================================

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

COMMENT ON COLUMN hotel_settings.notification_email IS
  'Email-Adresse(n) für Booking-Notifications. Multiple per Komma trennen. NULL = keine Notification (Best-Effort). Custom-Domain als Absender kommt in Sprint D Phase 7.';
