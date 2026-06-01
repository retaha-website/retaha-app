-- Sprint Functional Modul C Phase 7 — Eve-Message-Feedback
--
-- Gast bewertet einzelne Eve-Antworten mit Daumen hoch/runter.
-- UNIQUE(stay_id, message_id): pro Message nur 1 Vote — Re-Click ist
-- ein Update, nicht doppelter Eintrag.

CREATE TABLE IF NOT EXISTS eve_message_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  stay_id          UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  hotel_id         UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  rating           SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  optional_comment TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stay_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_eve_feedback_hotel_rating
  ON eve_message_feedback(hotel_id, rating, created_at DESC);

CREATE OR REPLACE FUNCTION set_eve_feedback_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eve_feedback_set_updated_at ON eve_message_feedback;
CREATE TRIGGER eve_feedback_set_updated_at
  BEFORE UPDATE ON eve_message_feedback
  FOR EACH ROW EXECUTE FUNCTION set_eve_feedback_updated_at();

ALTER TABLE eve_message_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read eve_feedback" ON eve_message_feedback;
CREATE POLICY "Hotel members read eve_feedback"
  ON eve_message_feedback FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

-- INSERT/UPDATE: nur via Service-Role-Endpoint mit Stay-Session-Auth.

COMMENT ON TABLE eve_message_feedback IS
  'Sprint Functional Modul C Phase 7: Gast-Feedback zu einzelnen Eve-Antworten (Daumen hoch/runter). 1 Vote pro Message pro Stay (UNIQUE).';
