-- Sprint E7 Phase 5 — hotel_settings.recommendations deprecaten
--
-- Naming-Konflikt aus Sprint E2 ist gelöst: was "recommendations" hieß
-- ist eigentlich das Action-Card-System → wandert nach hotel_action_cards.
-- Eve liest schon korrekt aus place_picks (Sprint E2 Phase 9).
--
-- Phase-5-Cleanup-Schritt: Spalte als deprecated markieren, NICHT droppen.
-- Grund: bei Production-Migration (Sprint G) ist die Spalte noch als
-- Safety-Net da falls was schiefgeht. Echter DROP COLUMN kommt nach
-- Production-Verifikation als bewusster eigener Cleanup-Schritt.
--
-- Verifikation vor diesem Schritt (durchgeführt 2026-05-31):
--   - 1 von 11 Hotels (Demo) hatte 3 JSONB-Cards → alle migriert in
--     hotel_action_cards
--   - 10 weitere Hotels haben 0 JSONB-Cards → nichts zu migrieren
--   - Kein Hotel mit "MIGRATION FEHLT" Status
--   - /g/[token].astro Fallback-Pfad bereits entfernt
--   - queries.ts liest die Spalte nicht mehr (recommendations? optional)
--   - /admin/dashboard zählt jetzt aus hotel_action_cards
--   - /admin/recommendations → 308 Redirect auf /admin/action-cards

COMMENT ON COLUMN hotel_settings.recommendations IS
  'DEPRECATED (Sprint E7): Ersetzt durch hotel_action_cards. '
  'Spalte bleibt vorerst als Safety-Net bis Sprint G Production-Cleanup. '
  'Nicht mehr von App-Code gelesen — Reads würden ins Leere zeigen.';
