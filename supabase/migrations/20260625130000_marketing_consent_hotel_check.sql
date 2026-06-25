-- Mandanten-Integrität (Multi-Tenancy-Härtung, Abschluss des Consent-Strangs)
--
-- Regel: marketing_waitlist + marketing_consents dürfen NUR dann ohne hotel_id
-- stehen, wenn es sich um den hotel-losen retaha-Newsletter handelt. Jede
-- hotel-gebundene Quelle (guest_checkout, wallet_add, opt_out_link,
-- doi_confirm_link, email_unsubscribe_link, api, …) MUSS ein hotel_id tragen —
-- sonst wäre der Consent-/Waitlist-Eintrag hotelübergreifend sichtbar (Leak).
--
-- Kanonische hotel-lose Quelle = 'retaha_newsletter'. Der alte waitlist-DEFAULT
-- 'retaha.de' wird darauf umgestellt, damit ein default-getriebener (source-loser)
-- Insert ohne hotel_id nicht den CHECK verletzt. `source` ist in beiden Tabellen
-- bereits NOT NULL → kein NULL-Schlupfloch (hotel_id NULL + source NULL).
--
-- Voraussetzung: Vor dieser Migration wurden 4 hotel-lose Test-Rows (source 'api'
-- bzw. 'doi_confirm_link', 16.06.2026) entfernt → 0 Violators, ADD CONSTRAINT
-- validiert sofort.

ALTER TABLE public.marketing_waitlist
  ALTER COLUMN source SET DEFAULT 'retaha_newsletter';

ALTER TABLE public.marketing_waitlist
  ADD CONSTRAINT marketing_waitlist_hotel_or_newsletter_chk
  CHECK (hotel_id IS NOT NULL OR source = 'retaha_newsletter');

ALTER TABLE public.marketing_consents
  ADD CONSTRAINT marketing_consents_hotel_or_newsletter_chk
  CHECK (hotel_id IS NOT NULL OR source = 'retaha_newsletter');
