-- Phase 6: Downgrade-Datenlöschung — Lösch-Fahrplan
-- Neue Tabelle module_deletion_schedule + deletion_log-Constraint erweitern.

-- ── module_deletion_schedule ──────────────────────────────────────────────────
-- Pro Hotel/Modul ein Eintrag sobald ein Downgrade erkannt wird.
-- Daten bleiben 30 Tage (grace period); Cron löscht erst dann.
-- Reaktivierung setzt status=canceled → keine Löschung.

CREATE TABLE IF NOT EXISTS module_deletion_schedule (
  id               uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  hotel_id         uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key       text NOT NULL,
  scheduled_at     timestamptz NOT NULL DEFAULT now(),
  deletion_due_at  timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'canceled', 'deleted')),
  triggered_by     text NOT NULL,   -- 'subscription.updated' | 'subscription.deleted'
  old_plan         text,            -- Audit: welcher Plan vorher
  new_plan         text             -- Audit: welcher Plan danach (null bei Kündigung)
);

CREATE INDEX IF NOT EXISTS module_deletion_schedule_hotel_module_status_idx
  ON module_deletion_schedule (hotel_id, module_key, status);

CREATE INDEX IF NOT EXISTS module_deletion_schedule_due_pending_idx
  ON module_deletion_schedule (deletion_due_at)
  WHERE status = 'pending';

-- ── deletion_log: subject_type um 'module_downgrade' erweitern ────────────────
ALTER TABLE deletion_log
  DROP CONSTRAINT IF EXISTS deletion_log_subject_type_check;

ALTER TABLE deletion_log
  ADD CONSTRAINT deletion_log_subject_type_check CHECK (
    subject_type = ANY (ARRAY[
      'eve_conversations',
      'app_data',
      'auto_checkout',
      'guest_request',
      'hotelier_request',
      'retention',
      'module_downgrade'
    ])
  );
