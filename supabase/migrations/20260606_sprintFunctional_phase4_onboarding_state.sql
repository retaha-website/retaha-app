-- Sprint Functional Modul B Phase 4 — onboarding_state
--
-- Tracking ob der Hotelier den Setup-Wizard durchlaufen hat. Die
-- Checkliste im Dashboard nutzt Read-Time-Checks (Option B aus Briefing)
-- für "tatsächlich vorhandene Daten" — diese Tabelle trackt nur ob der
-- Wizard explizit durchlaufen wurde + completed_at-Timestamp.
--
-- Backfill: alle bestehenden 11 Hotels sind voll eingerichtet → alle
-- step_* = true, completed_at = NOW(). Sie sollen die Checkliste nicht
-- plötzlich als "Schritt 1/10" sehen.

CREATE TABLE IF NOT EXISTS onboarding_state (
  hotel_id              UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  step_account          BOOLEAN NOT NULL DEFAULT false,
  step_hotel_basics     BOOLEAN NOT NULL DEFAULT false,
  step_address          BOOLEAN NOT NULL DEFAULT false,
  step_languages        BOOLEAN NOT NULL DEFAULT false,
  step_mews             BOOLEAN NOT NULL DEFAULT false,
  step_wifi             BOOLEAN NOT NULL DEFAULT false,
  step_breakfast        BOOLEAN NOT NULL DEFAULT false,
  step_eve_knowledge    BOOLEAN NOT NULL DEFAULT false,
  step_action_cards     BOOLEAN NOT NULL DEFAULT false,
  step_team_invited     BOOLEAN NOT NULL DEFAULT false,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_state_set_updated_at ON onboarding_state;
CREATE TRIGGER onboarding_state_set_updated_at
  BEFORE UPDATE ON onboarding_state
  FOR EACH ROW EXECUTE FUNCTION set_onboarding_state_updated_at();

-- RLS analog hotel_action_cards
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read onboarding_state" ON onboarding_state;
CREATE POLICY "Hotel members read onboarding_state"
  ON onboarding_state FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members update onboarding_state" ON onboarding_state;
CREATE POLICY "Hotel members update onboarding_state"
  ON onboarding_state FOR UPDATE
  USING (hotel_id IN (SELECT user_hotel_ids()))
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members insert onboarding_state" ON onboarding_state;
CREATE POLICY "Hotel members insert onboarding_state"
  ON onboarding_state FOR INSERT
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

-- Backfill: bestehende 11 Hotels sind voll eingerichtet → alle Steps true
INSERT INTO onboarding_state (
  hotel_id, step_account, step_hotel_basics, step_address, step_languages,
  step_mews, step_wifi, step_breakfast, step_eve_knowledge, step_action_cards,
  step_team_invited, completed_at, created_at
)
SELECT
  id, true, true, true, true, true, true, true, true, true, true,
  NOW(), NOW()
FROM hotels
ON CONFLICT (hotel_id) DO NOTHING;

COMMENT ON TABLE onboarding_state IS
  'Sprint Functional Modul B: trackt Setup-Wizard-Progress. Dashboard-Checkliste nutzt zusätzlich Read-Time-Counts in den realen Tabellen (Eve-Knowledge ≥3, Action-Cards ≥1 etc.).';
