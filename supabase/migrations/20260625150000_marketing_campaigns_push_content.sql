-- C-Full Kampagnen-Editor: getrennter Inhalt je Kanal.
--
-- Wallet-Push bekommt eigenen kurzen Titel + Text, unabhängig vom E-Mail-Betreff
-- + Rich-Text (title_i18n / body_i18n bleiben der E-Mail-Inhalt). Beide nullable
-- mit Fallback: ist push_*_i18n NULL (Bestands-Kampagnen, Drips, oder „Push-Inhalt
-- nicht ausgefüllt"), nutzt der Versand weiterhin title_i18n / body_i18n → das
-- Verhalten für alles Bestehende bleibt unverändert.
--
-- RLS: marketing_campaigns hat bereits Hotel-gescopte Policies; die neuen Spalten
-- erben sie, kein zusätzliches GRANT/Policy nötig.

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS push_title_i18n jsonb,
  ADD COLUMN IF NOT EXISTS push_body_i18n jsonb;

COMMENT ON COLUMN public.marketing_campaigns.push_title_i18n IS
  'Separater Wallet-Push-Titel (i18n). NULL → Versand nutzt title_i18n (E-Mail-Betreff).';
COMMENT ON COLUMN public.marketing_campaigns.push_body_i18n IS
  'Separater Wallet-Push-Text (i18n, kurz/plain). NULL → Versand nutzt body_i18n (E-Mail-Inhalt, gekürzt).';
