-- Sprint Wallet · Phase 12 — Drip-State-Lifecycle
--
-- Erweitert marketing_drip_state um:
--   - last_step_sent_at: wann der letzte Step versendet wurde (Diagnostics)
--   - completed_at:      Drip-Sequenz für diesen Pass abgeschlossen
--
-- Index-Refactor: alter Magic-999-Filter raus, neuer Filter auf completed_at
-- IS NULL (sauberer + ehrlicher).

ALTER TABLE marketing_drip_state
  ADD COLUMN IF NOT EXISTS last_step_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_drip_state_next;

-- Aktive Drips: completed_at IS NULL. Sortierung nach triggered_at für FIFO.
CREATE INDEX idx_drip_state_active
  ON marketing_drip_state(drip_id, triggered_at)
  WHERE completed_at IS NULL;

COMMENT ON COLUMN marketing_drip_state.last_step_sent_at IS
  'Sprint Wallet Phase 12: Zeitstempel des letzten erfolgreich versendeten Steps. NULL solange noch nichts versendet.';
COMMENT ON COLUMN marketing_drip_state.completed_at IS
  'Sprint Wallet Phase 12: Drip-Sequenz fuer diesen Pass abgeschlossen (letzter Step versendet oder Pass opted_out / expired waehrend Sequenz).';
