-- Sprint D · Phase 6a — Pre-Arrival-Email-Idempotenz
-- ========================================================================
-- Pre-Arrival-Mail wird beim Mews-Sync getriggert. Damit sie pro Stay nur
-- EINMAL rausgeht, brauchen wir eine Idempotenz-Spalte. Reset auf NULL
-- nicht vorgesehen — wer den Test wiederholen will, setzt sie manuell.
--
-- Plus Index für die Trigger-Query (check_in in [today, today+2d] AND
-- pre_arrival_sent_at IS NULL AND state='Confirmed').
-- ========================================================================

ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS pre_arrival_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN stays.pre_arrival_sent_at IS
  'Zeitpunkt des Pre-Arrival-Mail-Versands. NULL = noch nicht gesendet. Wird in syncHotelFromMews nach erfolgreichem Sync gesetzt — nie automatisch zurückgesetzt (manueller UPDATE nötig für Re-Test).';

-- Index für die Such-Query — partial index ist die platzsparende Variante
-- (typisch sind 95%+ der stays bereits "sent" und können den Index ignorieren).
CREATE INDEX IF NOT EXISTS stays_pre_arrival_pending_idx
  ON stays (check_in)
  WHERE pre_arrival_sent_at IS NULL AND is_active = true;
