-- Sprint D · Phase 7 — Custom-Domain via Resend für Customer-Facing-Mails
-- ========================================================================
-- Hybrid-Setup: Microsoft 365 SMTP bleibt für Hotelier-interne Mails (Booking-
-- Notifications), Resend dazu für Customer-Facing-Mails (Pre-Arrival, später
-- weitere Gast-Mails). Custom-Domain pro Hotel via Resend Domain-Delegation.
--
-- Status-Lifecycle:
--   NULL → keine Domain konfiguriert → Fallback auf Microsoft retaha-Default
--   'pending' → Domain bei Resend angelegt, DNS-Records ausstehend
--   'verified' → DNS verifiziert, Resend-Versand aktiv
--   'failed' → Verifikation fehlgeschlagen (DNS-Issue, manuelle Behebung)
-- ========================================================================

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS custom_email_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_email_status TEXT,
  ADD COLUMN IF NOT EXISTS resend_domain_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hotel_settings_custom_email_status_check'
  ) THEN
    ALTER TABLE hotel_settings
      ADD CONSTRAINT hotel_settings_custom_email_status_check
      CHECK (custom_email_status IS NULL OR custom_email_status IN ('pending', 'verified', 'failed'));
  END IF;
END $$;

COMMENT ON COLUMN hotel_settings.custom_email_domain IS
  'Hotel-eigene Sender-Domain für Customer-Facing-Mails (z.B. gategardenhotel.de). Customer-facing Mails werden als welcome@<domain> versendet wenn status=verified, sonst Fallback noreply@retaha.de.';
COMMENT ON COLUMN hotel_settings.custom_email_status IS
  'Domain-Status bei Resend: NULL=nicht konfiguriert, pending=DNS ausstehend, verified=aktiv, failed=manuell beheben.';
COMMENT ON COLUMN hotel_settings.resend_domain_id IS
  'Resend-Domain-Id (UUID von Resend), gebraucht für /domains/{id}/verify und Status-Polling.';
