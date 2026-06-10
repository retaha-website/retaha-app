-- Phase 8: Onboarding + Trial-Tracking
--
-- Erweitert die hotels-Tabelle um vier Felder für Trial- und Subscription-Lifecycle.
-- Bestehende Hotels (Demo-Daten) sollten nach der Migration auf 'active' gesetzt werden,
-- siehe separate UPDATE-Anweisung im Phase-8.A/B-Bericht.

ALTER TABLE hotels
  ADD COLUMN trial_started_at TIMESTAMPTZ,
  ADD COLUMN subscription_status VARCHAR(20) NOT NULL DEFAULT 'pre_trial'
    CHECK (subscription_status IN ('pre_trial', 'trial', 'active', 'cancelled', 'expired')),
  ADD COLUMN stripe_customer_id VARCHAR(255),
  ADD COLUMN stripe_subscription_id VARCHAR(255);

-- Indices für häufige Status-Queries (Trial-Expiry-Check, Banner-Logic in 8.F/8.G)
CREATE INDEX idx_hotels_subscription_status ON hotels(subscription_status);
CREATE INDEX idx_hotels_trial_started_at ON hotels(trial_started_at) WHERE trial_started_at IS NOT NULL;
