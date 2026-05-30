-- Sprint E4 · Phase 1 — Eve Knowledge-Base
-- Erstellt: 2026-06-01
--
-- Hotelier pflegt Eve's Wissen (FAQ, Hausregeln, Anfahrt, Tipps).
-- DE wird vom Hotelier gepflegt, Übersetzungen kommen On-the-fly in
-- eve_knowledge_translations (Phase 12).

CREATE TABLE IF NOT EXISTS eve_knowledge (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('faq', 'rules', 'directions', 'tip')),
  question     TEXT,                              -- NULL für rules/directions (nur answer)
  answer       TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'de',
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eve_knowledge_hotel_published
  ON eve_knowledge(hotel_id, is_published, category);

ALTER TABLE eve_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eve_knowledge: hotel owner read"   ON eve_knowledge;
DROP POLICY IF EXISTS "eve_knowledge: hotel owner insert" ON eve_knowledge;
DROP POLICY IF EXISTS "eve_knowledge: hotel owner update" ON eve_knowledge;
DROP POLICY IF EXISTS "eve_knowledge: hotel owner delete" ON eve_knowledge;

CREATE POLICY "eve_knowledge: hotel owner read"
  ON eve_knowledge FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "eve_knowledge: hotel owner insert"
  ON eve_knowledge FOR INSERT
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "eve_knowledge: hotel owner update"
  ON eve_knowledge FOR UPDATE
  USING (hotel_id IN (SELECT user_hotel_ids()))
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "eve_knowledge: hotel owner delete"
  ON eve_knowledge FOR DELETE
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE eve_knowledge IS
  'Hotelier-gepflegte Wissensbasis für Eve. DE ist Master, Übersetzungen in eve_knowledge_translations.';
COMMENT ON COLUMN eve_knowledge.category IS
  'faq=Q&A-Paar, rules=Hausregeln (nur answer), directions=Anfahrt (nur answer), tip=Tipp.';
COMMENT ON COLUMN eve_knowledge.question IS
  'NULL bei rules/directions/tip — nur answer wird verwendet.';
