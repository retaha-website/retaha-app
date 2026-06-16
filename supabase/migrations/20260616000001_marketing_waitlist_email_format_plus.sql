-- Lockert marketing_waitlist_email_format: + (Plus-Adressierung) ist RFC-gültig.
-- App-Regex und DB-Constraint müssen identisch sein:
--   /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

ALTER TABLE public.marketing_waitlist
  DROP CONSTRAINT IF EXISTS marketing_waitlist_email_format;

ALTER TABLE public.marketing_waitlist
  ADD CONSTRAINT marketing_waitlist_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Junk-Zeile entfernen (Test-Eintrag)
DELETE FROM public.marketing_waitlist WHERE email = 'deine@mail.de';
