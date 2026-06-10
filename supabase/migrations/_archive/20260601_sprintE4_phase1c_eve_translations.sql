-- Sprint E4 · Phase 1 — Übersetzungs-Cache für Eve-Knowledge
-- Erstellt: 2026-06-01
--
-- DE ist Master (eve_knowledge.answer/question). Bei erster Anfrage in en/fr/es
-- wird via Haiku übersetzt und hier gespeichert. Spätere Anfragen treffen Cache,
-- 0 zusätzliche Tokens für Übersetzung (Phase 12).

CREATE TABLE IF NOT EXISTS eve_knowledge_translations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id        UUID NOT NULL REFERENCES eve_knowledge(id) ON DELETE CASCADE,
  language_code       TEXT NOT NULL CHECK (language_code IN ('en', 'fr', 'es')),
  translated_question TEXT,
  translated_answer   TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(knowledge_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_eve_translations_lookup
  ON eve_knowledge_translations(knowledge_id, language_code);

ALTER TABLE eve_knowledge_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eve_translations: hotel owner all" ON eve_knowledge_translations;

-- Owner darf lesen + schreiben (Service-Role im Cache-Write-Pfad bypasst RLS sowieso).
-- Wir prüfen über JOIN auf eve_knowledge.hotel_id.
CREATE POLICY "eve_translations: hotel owner all"
  ON eve_knowledge_translations FOR ALL
  USING (
    knowledge_id IN (
      SELECT id FROM eve_knowledge WHERE hotel_id IN (SELECT user_hotel_ids())
    )
  )
  WITH CHECK (
    knowledge_id IN (
      SELECT id FROM eve_knowledge WHERE hotel_id IN (SELECT user_hotel_ids())
    )
  );

COMMENT ON TABLE eve_knowledge_translations IS
  'Übersetzungs-Cache (en/fr/es). DE ist Master in eve_knowledge.answer/question. Nur Service-Role schreibt (Haiku-Output).';
