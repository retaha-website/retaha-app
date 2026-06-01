-- Sprint Wallet · Modul E — Wiederkehrer-Mechanismus
--
-- Verknüpft Stays mit Wallet-Pässen für: Hotelier-Sichtbarkeit (Dashboard,
-- Stay-Detail-Pill, Marketing-Filter), Eve-Awareness (isReturningGuest),
-- Wallet-Deep-Link-Auth.

ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS wallet_pass_id UUID REFERENCES wallet_passes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stays_wallet_pass
  ON stays(wallet_pass_id) WHERE wallet_pass_id IS NOT NULL;

-- Convenience-Index für Dashboard-Query "Wiederkehrer diese Woche"
CREATE INDEX IF NOT EXISTS idx_stays_hotel_check_in
  ON stays(hotel_id, check_in DESC) WHERE wallet_pass_id IS NOT NULL;

COMMENT ON COLUMN stays.wallet_pass_id IS
  'Sprint Wallet Modul E: Verknüpfung zu wallet_passes via Email-Match (Mews-Sync) oder Wallet-Click-Deep-Link. NULL = Gast hat keinen Wallet-Pass.';
