-- marketing_consents.hotel_id — Mandantentrennung.
--
-- Befund (Inventur): marketing_consents hatte keinen direkten Hotel-Bezug (nur über
-- wallet_pass_id / waitlist_id). Die "Recent Consents"-Liste in consent.astro las per
-- Service-Role ohne Hotel-Filter → hotelübergreifend. Diese Migration ergänzt hotel_id,
-- backfillt aus dem Pass-/Waitlist-Bezug und scoped die SELECT-RLS auf das Hotel.
--
-- ON DELETE SET NULL + nullable (analog 20260617000000_marketing_waitlist_hotel_id):
-- Audit-Zeilen bleiben erhalten, und Waitlist-Einträge ohne Hotel bleiben möglich.
-- Daher bewusst KEIN NOT NULL hier — separater Schritt nach Verifikation, falls gewünscht.

ALTER TABLE public.marketing_consents
  ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Backfill 1: über Wallet-Pass
UPDATE public.marketing_consents mc
SET hotel_id = wp.hotel_id
FROM public.wallet_passes wp
WHERE mc.hotel_id IS NULL AND mc.wallet_pass_id = wp.id;

-- Backfill 2: über Waitlist (nur wo die Waitlist ein Hotel hat)
UPDATE public.marketing_consents mc
SET hotel_id = wl.hotel_id
FROM public.marketing_waitlist wl
WHERE mc.hotel_id IS NULL AND mc.waitlist_id = wl.id AND wl.hotel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_consents_hotel_id_idx
  ON public.marketing_consents(hotel_id);

-- RLS: SELECT nur eigenes Hotel. Ersetzt die alte wallet_pass_id-basierte Policy,
-- die Waitlist-Consents (wallet_pass_id IS NULL) gar nicht erfasste.
-- Service-Role-Inserts bleiben unberührt (RLS-Bypass).
DROP POLICY IF EXISTS "Hotel members read marketing_consents" ON public.marketing_consents;
CREATE POLICY "Hotel members read marketing_consents"
  ON public.marketing_consents
  FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));
