-- Phase 4 (Mega-Sprint Tag 19): Loyalty-Points-Tabelle anlegen
-- Minimales Schema für Pro-Modul "Loyalty-Program" (Beta)

CREATE TABLE IF NOT EXISTS loyalty_points (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id         uuid        NOT NULL,
  points           integer     NOT NULL DEFAULT 0,
  tier             text        NOT NULL DEFAULT 'bronze'
    CONSTRAINT loyalty_tier_check CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  tier_progress    integer     NOT NULL DEFAULT 0,
  benefits         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  earned_history   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_hotel_guest_uniq
  ON loyalty_points (hotel_id, guest_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_hotel
  ON loyalty_points (hotel_id);

-- RLS: Backoffice-User lesen eigene Hotel-Punkte
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_select_hotel_users" ON loyalty_points
  FOR SELECT USING (
    hotel_id IN (
      SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_write_service_role" ON loyalty_points
  FOR ALL USING (auth.role() = 'service_role');

-- Updated-at Trigger
CREATE OR REPLACE FUNCTION update_loyalty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loyalty_updated_at
  BEFORE UPDATE ON loyalty_points
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();
