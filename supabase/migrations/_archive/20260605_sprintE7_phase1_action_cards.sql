-- Sprint E7 Phase 1 — Action-Cards in eigene relationale Tabelle
--
-- Löst den Naming-Konflikt aus Sprint E2: hotel_settings.recommendations
-- hieß irreführend "recommendations", war aber das Action-Card-System.
-- Sprint E2 hat das Empfehlungs-System sauber in hotel_place_picks gebaut
-- (Eve liest dort schon korrekt). Dieser Sprint zieht die Action-Cards in
-- hotel_action_cards um — die alte JSONB-Spalte bleibt vorerst als Fallback
-- (Cleanup in Phase 5 nach Verifikation des Gast-Frontends).
--
-- Schema-Felder:
--   - card_type CHECK ('internal_action', 'external_link', 'info', 'phone', 'email')
--   - action_target: kontextabhängig (Sheet-Slug / URL / tel / email / null)
--   - title_de NOT NULL, alle anderen Texte nullable
--   - subtitle_* (entspricht 'sub_*' in alter JSONB, beim Migrieren mappen)
--   - eyebrow_* + cta_* additiv (waren in alter JSONB → Daten gehen sonst verloren)
--   - card_class als TEXT mit DEFAULT 'rec-anthrazit', KEIN CHECK
--     (rec-anthrazit / rec-white / rec-burgundy + zukünftige Werte erlaubt)
--   - is_published + sort_order für Lifecycle

CREATE TABLE IF NOT EXISTS hotel_action_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,

  card_type     TEXT NOT NULL CHECK (card_type IN (
    'internal_action', 'external_link', 'info', 'phone', 'email'
  )),
  action_target TEXT,

  -- Texte (de NOT NULL, alle anderen nullable)
  title_de      TEXT NOT NULL,
  title_en      TEXT,
  title_fr      TEXT,
  title_es      TEXT,

  subtitle_de   TEXT,
  subtitle_en   TEXT,
  subtitle_fr   TEXT,
  subtitle_es   TEXT,

  eyebrow_de    TEXT,
  eyebrow_en    TEXT,
  eyebrow_fr    TEXT,
  eyebrow_es    TEXT,

  cta_de        TEXT,
  cta_en        TEXT,
  cta_fr        TEXT,
  cta_es        TEXT,

  -- Visuelles
  image_url     TEXT,
  card_class    TEXT NOT NULL DEFAULT 'rec-anthrazit',

  -- Lifecycle
  is_published  BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lese-Index für Gast-Frontend (filtert auf is_published + sortiert)
CREATE INDEX IF NOT EXISTS idx_action_cards_hotel
  ON hotel_action_cards(hotel_id, is_published, sort_order);

-- updated_at-Trigger (Standard-Pattern im Projekt)
CREATE OR REPLACE FUNCTION set_action_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_cards_set_updated_at ON hotel_action_cards;
CREATE TRIGGER action_cards_set_updated_at
  BEFORE UPDATE ON hotel_action_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_action_cards_updated_at();

-- RLS analog hotel_place_picks (Sprint E2)
ALTER TABLE hotel_action_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read action_cards" ON hotel_action_cards;
CREATE POLICY "Hotel members read action_cards"
  ON hotel_action_cards FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members insert action_cards" ON hotel_action_cards;
CREATE POLICY "Hotel members insert action_cards"
  ON hotel_action_cards FOR INSERT
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members update action_cards" ON hotel_action_cards;
CREATE POLICY "Hotel members update action_cards"
  ON hotel_action_cards FOR UPDATE
  USING (hotel_id IN (SELECT user_hotel_ids()))
  WITH CHECK (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members delete action_cards" ON hotel_action_cards;
CREATE POLICY "Hotel members delete action_cards"
  ON hotel_action_cards FOR DELETE
  USING (hotel_id IN (SELECT user_hotel_ids()));

-- Anonymous-Read via JWT (Stay-Session) — Gast-Frontend braucht Cards für
-- sein Hotel ohne Hotelier-Login. Pattern wie place_picks / hotel_settings.
DROP POLICY IF EXISTS "Anyone read published action_cards" ON hotel_action_cards;
CREATE POLICY "Anyone read published action_cards"
  ON hotel_action_cards FOR SELECT
  USING (is_published = true);

COMMENT ON TABLE hotel_action_cards IS
  'Sprint E7: Hero-Swipe-Cards im Gast-Frontend (vorher hotel_settings.recommendations JSONB). 5 card_types (internal_action/external_link/info/phone/email).';
