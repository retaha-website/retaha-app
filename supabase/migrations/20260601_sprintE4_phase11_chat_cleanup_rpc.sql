-- Sprint E4 · Phase 11 — Auto-Delete-RPC für chat_messages
-- Erstellt: 2026-06-01
--
-- Löscht chat_messages für Stays die bereits "abgeschlossen" sind:
--   stay.state IN ('Processed', 'Canceled') AND check_out < NOW() - 1 day
--
-- Briefing-Anpassung (Phase-0-Discovery): stays.state nicht .status; Werte
-- aus Mews-API sind Confirmed/Started/Processed/Canceled.
--
-- SECURITY DEFINER damit der Cron-Endpoint (auth-via-CRON_SECRET) das
-- aufrufen kann ohne RLS-Bypass-Berechtigung explizit zu brauchen.

CREATE OR REPLACE FUNCTION cleanup_eve_chat_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_messages
  WHERE stay_id IN (
    SELECT id FROM stays
    WHERE state IN ('Processed', 'Canceled')
      AND check_out < NOW() - INTERVAL '1 day'
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_eve_chat_messages() IS
  'Sprint E4 Phase 11 — Löscht chat_messages für Stays mit state Processed/Canceled und check_out > 1 Tag in der Vergangenheit. Aufgerufen vom täglichen Cron /api/cron/eve-chat-cleanup.';
