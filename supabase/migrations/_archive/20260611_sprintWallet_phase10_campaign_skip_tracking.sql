-- Sprint Wallet · Phase 10 — Skip-Tracking auf marketing_campaigns
--
-- Wenn ein Bulk-Send läuft, wollen wir nicht nur die ge-sendeten Recipients
-- zählen sondern auch die ge-skippten (z.B. opted_out → kein Marketing-Push).
-- Die Skip-Reasons sind wichtig fürs Hotelier-Dashboard ("198 versendet,
-- 49 opted_out").

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS skipped_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_reasons  JSONB,
  -- z.B. { "marketing_opted_out": 49, "marketing_consent_missing": 12, "pass_expired": 2 }
  ADD COLUMN IF NOT EXISTS send_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_error      TEXT;

COMMENT ON COLUMN marketing_campaigns.skip_reasons IS
  'Sprint Wallet Phase 10: JSONB {reason: count} aus push-guard. Mapped 1:1 zu canSendPush.reason-Strings.';
COMMENT ON COLUMN marketing_campaigns.send_started_at IS
  'Sprint Wallet Phase 10: wann der Bulk-Send-Run gestartet ist (Diff zu sent_at = Send-Dauer).';
