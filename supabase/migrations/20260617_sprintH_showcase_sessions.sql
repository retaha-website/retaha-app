-- Sprint H · Group 2 — Showcase-Sessions
--
-- Hotelier kann eine Demo-Session anlegen die sich wie ein echter Stay
-- verhält, aber:
--   - NICHT an Mews gepushed wird
--   - "DEMO-MODE"-Badge im Gast-Frontend zeigt
--   - Reset-Button löscht alle Demo-Daten (bookings + chat_messages)
--
-- Token-Format: 'showcase_<32-hex>' (klar vom Stay-Token unterscheidbar
-- via Prefix; Stay-Token sind base64url 24-32 chars).

CREATE TABLE IF NOT EXISTS showcase_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  -- Demo-Daten als JSONB damit Hotelier später Namen/Zimmer customizen kann
  demo_data JSONB NOT NULL DEFAULT '{
    "guest_first_name": "Anna",
    "guest_last_name": "Demo",
    "room_number": "101",
    "room_name": "Demo-Suite"
  }'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reset_count INT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showcase_hotel_active
  ON showcase_sessions(hotel_id) WHERE is_active = true;

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION set_showcase_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS showcase_sessions_updated_at ON showcase_sessions;
CREATE TRIGGER showcase_sessions_updated_at BEFORE UPDATE ON showcase_sessions
  FOR EACH ROW EXECUTE FUNCTION set_showcase_updated_at();

ALTER TABLE showcase_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read showcase_sessions" ON showcase_sessions;
CREATE POLICY "Hotel members read showcase_sessions"
  ON showcase_sessions FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE showcase_sessions IS
  'Sprint H Group 2: Demo-Sessions für Hotelier — Service-/Eve-Requests werden geloggt aber NICHT an Mews gepushed.';
COMMENT ON COLUMN showcase_sessions.token IS
  'Format showcase_<32-hex>. Vom Frontend via Prefix unterscheidbar von echten Stay-Tokens.';

-- ─── Showcase-Spalten in bookings + chat_messages ─────────────────────
-- ON DELETE CASCADE: löscht alle Showcase-Items wenn die Session gelöscht wird

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS showcase_session_id UUID REFERENCES showcase_sessions(id) ON DELETE CASCADE;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS showcase_session_id UUID REFERENCES showcase_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookings_showcase ON bookings(showcase_session_id) WHERE showcase_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_showcase ON chat_messages(showcase_session_id) WHERE showcase_session_id IS NOT NULL;
