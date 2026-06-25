-- Gast-Sprache am Marketing-Kontakt hinterlegen (für Versand in der vom Gast
-- gewählten App-Sprache).
--
-- Beim Opt-in gesetzt: Wallet-Add (aus guests.language) bzw. E-Mail-DOI (aus der
-- Stay-Session-Sprache). send.ts nutzt sie pro Empfänger; ist sie NULL (Legacy
-- oder reiner Newsletter ohne Stay), greift der Mews-Fallback (guests.language
-- per E-Mail-Join) bzw. zuletzt die Hotel-Standardsprache.
--
-- Nullable; RLS erbt die bestehenden hotel-gescopten Policies beider Tabellen.

ALTER TABLE public.wallet_passes
  ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.marketing_waitlist
  ADD COLUMN IF NOT EXISTS language text;

COMMENT ON COLUMN public.wallet_passes.language IS
  'Vom Gast gewählte App-Sprache (beim Wallet-Add, aus guests.language). Versand-Sprache; NULL → Fallback.';
COMMENT ON COLUMN public.marketing_waitlist.language IS
  'Vom Gast gewählte App-Sprache (beim E-Mail-DOI). Versand-Sprache; NULL → Fallback.';
