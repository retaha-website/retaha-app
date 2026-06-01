-- Sprint Wallet · Phase 7 — Marketing-Consent-Audit-Log
--
-- Audit-Tabelle für jeden Consent-Wechsel: granted (Opt-In beim Wallet-Add)
-- oder revoked (Opt-Out via Link in Marketing-Push, oder Hotelier-Aktion).
--
-- Pattern wie consent_log aus Sprint Legal Phase 2: Append-Only, kein UPDATE,
-- jede State-Änderung wird neu eingetragen. wallet_passes.state ist der
-- aktuelle Stand, marketing_consents ist die Historie für DSGVO-Beweis.

CREATE TABLE IF NOT EXISTS marketing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_pass_id UUID NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  -- Quelle des Consent-Wechsels:
  --   'wallet_add'    – Opt-In beim Add-to-Wallet-Modal (/api/g/wallet/create)
  --   'opt_out_link'  – Click auf Opt-Out-Link in Marketing-Push
  --   'preferences'   – Self-Service UI (Backlog, Modul C)
  --   'admin_action'  – Hotelier-Cleanup (Backlog, Modul C)
  source TEXT NOT NULL,
  ip_hash TEXT,                      -- SHA-256 + STAY_SESSION_SECRET salt
  user_agent TEXT,
  policy_version TEXT NOT NULL,      -- "2026-06-01" etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_consents_pass
  ON marketing_consents(wallet_pass_id, created_at DESC);

ALTER TABLE marketing_consents ENABLE ROW LEVEL SECURITY;

-- Hotel-Member darf den Verlauf eines eigenen Wallet-Pass lesen
DROP POLICY IF EXISTS "Hotel members read marketing_consents" ON marketing_consents;
CREATE POLICY "Hotel members read marketing_consents"
  ON marketing_consents FOR SELECT
  USING (wallet_pass_id IN (
    SELECT id FROM wallet_passes WHERE hotel_id IN (SELECT user_hotel_ids())
  ));

-- Inserts laufen über Service-Role (Endpoints nach App-Side-Auth-Check).
-- KEIN UPDATE/DELETE (Audit-Append-Only).

COMMENT ON TABLE marketing_consents IS
  'Sprint Wallet Phase 7: Audit-Log für Marketing-Consent-State-Wechsel. Append-Only. Pattern wie consent_log/Sprint Legal Phase 2.';
