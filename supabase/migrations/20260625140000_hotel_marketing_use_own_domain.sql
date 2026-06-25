-- Hybrid-Versand-Routing (ACS / Resend): Schalter pro Hotel, ob Marketing-E-Mails
-- über die eigene (verifizierte) Resend-Domain statt über den retaha-ACS-Default gehen.
--
-- Default false → Bestandshotels senden unverändert über ACS. Der Provider-Resolver
-- (packages/marketing) sendet NUR dann über Resend, wenn dieser Schalter true UND
-- hotel_settings.custom_email_status = 'verified' ist. Schalter true, aber Domain
-- nicht verifiziert → Versand wird blockiert (KEIN stiller ACS-Fallback).
--
-- RLS: hotel_settings hat bereits owner read/insert/update via user_hotel_ids();
-- die neue Spalte erbt diese Policies, kein zusätzliches GRANT/Policy nötig.

ALTER TABLE public.hotel_settings
  ADD COLUMN IF NOT EXISTS marketing_use_own_domain boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hotel_settings.marketing_use_own_domain IS
  'Wenn true UND custom_email_status=verified: Marketing-E-Mails gehen über Resend mit der eigenen Domain statt über den retaha-ACS-Default.';
