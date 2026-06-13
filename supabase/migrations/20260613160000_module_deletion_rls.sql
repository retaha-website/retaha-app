-- Phase 6 Nacharbeit A: RLS auf module_deletion_schedule aktivieren
--
-- Ohne diese Migration war die Tabelle mit dem anon-Key les- und schreibbar.
-- Pattern identisch zu deletion_log (ENABLE RLS + Hotel-members-SELECT-Policy).
-- INSERT/UPDATE/DELETE: ausschließlich via service_role (Webhook + Cron) —
-- service_role bypassed RLS in Supabase implizit, keine explizite Policy nötig.

ALTER TABLE module_deletion_schedule ENABLE ROW LEVEL SECURITY;

-- Hotelier kann eigene Einträge lesen (für zukünftiges Dashboard-UI)
CREATE POLICY "Hotel members read module_deletion_schedule"
  ON module_deletion_schedule
  FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));
