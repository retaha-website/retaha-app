-- Sprint i18n-Expansion Phase 3d — eve_knowledge → i18n-JSONB
--
-- HISTORISCHER KONTEXT (Sprint E4 Phase 1a, 2026-06-01):
-- Die Original-Tabelle nutzt eine `language_code`-Spalte mit Row-per-Language.
-- Migration-Header damals: "DE wird vom Hotelier gepflegt, Übersetzungen
-- kommen On-the-fly in eve_knowledge_translations (Phase 12)."
--
-- Diese Spalte war eine VORSORGE für hypothetisches Multi-Sprach-Authoring
-- (mehrere Hoteliers pro Hotel, jeweils in anderer Sprache), das nie
-- eingetreten ist. Phase-0-Reality-Check (Sprint i18n-Expansion) verifiziert:
--   - Beide Hotels mit Knowledge: ausschließlich language_code='de'-Rows
--   - Alle Übersetzungen liefen via eve_knowledge_translations-Cache
--   - Niemals eine non-DE-Original-Row in der Produktion
--
-- → Konsolidierung sicher: alle Rows sind eh DE, mappen auf
--   question_i18n.de + answer_i18n.de (source='original'), Schema-Reduktion
--   um language_code in Phase 10 Cleanup.
--
-- Auch eve_knowledge_translations wird in Phase 10 obsolete (JSONB IST der
-- Cache jetzt, Phase-8-Eve liest direkt aus question_i18n).

ALTER TABLE eve_knowledge
  ADD COLUMN IF NOT EXISTS question_i18n JSONB,
  ADD COLUMN IF NOT EXISTS answer_i18n JSONB;

CREATE INDEX IF NOT EXISTS idx_eve_knowledge_answer_i18n
  ON eve_knowledge USING GIN (answer_i18n);

COMMENT ON COLUMN eve_knowledge.question_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt question + language_code (Row-per-Lang-Pattern). Phase 10 droppt alte Spalten + eve_knowledge_translations-Cache.';

COMMENT ON COLUMN eve_knowledge.answer_i18n IS
  'Sprint i18n: I18nValue JSONB (10 Sprachen). Ersetzt answer + language_code.';
