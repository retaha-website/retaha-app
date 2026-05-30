-- Sprint E4 · Phase 1 — Eve Action-Audit-Log
-- Erstellt: 2026-06-01
--
-- Sicherheit + Debugging: jede Action-Tool-Ausführung (create_breakfast_booking,
-- request_service, request_conference_room, cancel_booking) wird hier geloggt
-- — auch wenn der Gast abgebrochen hat (Confirmation-Step abgelehnt).
--
-- conversation_context: letzte 3 Messages (User + Assistant) damit Hotelier
-- nachvollziehen kann WARUM Eve das vorgeschlagen hat.

CREATE TABLE IF NOT EXISTS eve_action_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  stay_id              UUID REFERENCES stays(id) ON DELETE SET NULL,
  action_type          TEXT NOT NULL,
  action_params        JSONB NOT NULL,
  conversation_context TEXT,
  result               TEXT NOT NULL CHECK (result IN ('success', 'failed', 'cancelled_by_user')),
  result_data          JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eve_audit_hotel_time
  ON eve_action_log(hotel_id, created_at DESC);

ALTER TABLE eve_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eve_audit: hotel owner read" ON eve_action_log;
-- Hotelier darf lesen. Writes laufen ausschließlich via Service-Role (Eve-Endpoint),
-- daher kein INSERT-Policy nötig — Service-Role bypasst RLS.
CREATE POLICY "eve_audit: hotel owner read"
  ON eve_action_log FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE eve_action_log IS
  'Audit-Trail für Eve-Action-Tools. Service-Role-Writes, Hotelier-Read.';
COMMENT ON COLUMN eve_action_log.action_type IS
  'Action-Tool-Name: create_breakfast_booking, request_service, request_conference_room, cancel_booking.';
COMMENT ON COLUMN eve_action_log.action_params IS
  'Input-Params die Eve dem Tool übergeben hat (inkl. der vom Gast bestätigten Werte).';
COMMENT ON COLUMN eve_action_log.conversation_context IS
  'Letzte 3 Messages der Conversation (User + Assistant) als Text — damit Hotelier sieht warum Eve das vorschlug.';
COMMENT ON COLUMN eve_action_log.result IS
  'success=Booking erstellt o.ä., failed=API/DB-Fehler, cancelled_by_user=Gast hat Confirmation abgelehnt.';
COMMENT ON COLUMN eve_action_log.result_data IS
  'Resultat-Detail: bei success die booking_id, bei failed die Error-Message.';
