-- Phase 5: Stripe Customer + Subscription IDs
-- Werden ausschließlich vom Webhook (POST /api/stripe/webhook) befüllt.
-- Keine anderen Code-Stellen schreiben diese Spalten.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Für invoice.payment_failed-Lookup ohne extra API-Call
CREATE INDEX IF NOT EXISTS hotels_stripe_subscription_id_idx
  ON hotels (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
