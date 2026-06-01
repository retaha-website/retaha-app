-- Sprint Functional Modul C Phase 8 — Stay-Feedback (Hotel-Rating)
--
-- Gast bewertet seinen gesamten Aufenthalt mit 1-5 Sternen + optionalem
-- Kommentar. UNIQUE(stay_id) → pro Stay nur 1 Bewertung. Re-Submission
-- ist ein Update.

CREATE TABLE IF NOT EXISTS stay_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id       UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT false,  -- für künftige Marketing-Veröffentlichung (Backlog)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stay_id)
);

CREATE INDEX IF NOT EXISTS idx_stay_feedback_hotel
  ON stay_feedback(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stay_feedback_rating
  ON stay_feedback(hotel_id, rating);

CREATE OR REPLACE FUNCTION set_stay_feedback_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stay_feedback_set_updated_at ON stay_feedback;
CREATE TRIGGER stay_feedback_set_updated_at
  BEFORE UPDATE ON stay_feedback
  FOR EACH ROW EXECUTE FUNCTION set_stay_feedback_updated_at();

ALTER TABLE stay_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read stay_feedback" ON stay_feedback;
CREATE POLICY "Hotel members read stay_feedback"
  ON stay_feedback FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE stay_feedback IS
  'Sprint Functional Modul C Phase 8: Post-Stay-Bewertung (1-5 Sterne + optional Kommentar). 1 Eintrag pro Stay (UNIQUE).';
COMMENT ON COLUMN stay_feedback.is_published IS
  'Falls true: kann fürs Marketing freigegeben werden (Hotelier-Entscheidung). Aktuell nicht UI-exposed — Backlog.';
