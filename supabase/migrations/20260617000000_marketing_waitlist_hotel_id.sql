-- marketing_waitlist: hotel_id für hotel-spezifischen Gast-Opt-in (Checkout-Screen)
-- Nullable → bestehende Einträge (z.B. über Backoffice-Formular) bleiben unverändert.

ALTER TABLE public.marketing_waitlist
  ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_waitlist_hotel_id_idx
  ON public.marketing_waitlist(hotel_id);
