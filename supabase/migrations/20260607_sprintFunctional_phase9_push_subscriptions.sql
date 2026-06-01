-- Sprint Functional Modul D Phase 9 — Push-Subscriptions
--
-- Ein Eintrag pro (User|Stay) × Device. UNIQUE(endpoint) verhindert Doppel-
-- Subscriptions desselben Browsers. XOR-Constraint: entweder user_id (Hotelier-
-- Push) oder stay_id (Gast-Push, MVP-Backlog), nie beides.
--
-- MVP-Scope: Hotelier-Push aktiv. Gast-Push (stay_id-pfad) ist schema-ready,
-- aber KEIN Trigger-Code in MVP — eigener Sprint, sobald wir Confirmations etc.
-- versenden wollen.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stay_id     UUID REFERENCES stays(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT user_or_stay CHECK (
    (user_id IS NOT NULL AND stay_id IS NULL) OR
    (user_id IS NULL AND stay_id IS NOT NULL)
  ),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_hotel_user
  ON push_subscriptions(hotel_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subs_hotel_stay
  ON push_subscriptions(hotel_id, stay_id) WHERE stay_id IS NOT NULL;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Hotelier sieht seine eigenen Subscriptions (zum Anzeigen "auf 2 Geräten aktiviert").
DROP POLICY IF EXISTS "User reads own push_subscriptions" ON push_subscriptions;
CREATE POLICY "User reads own push_subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Hotelier kann eigene Subscriptions löschen (Unsubscribe / Logout).
DROP POLICY IF EXISTS "User deletes own push_subscriptions" ON push_subscriptions;
CREATE POLICY "User deletes own push_subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Inserts laufen über Service-Role nach App-Side-Auth-Check (siehe
-- /api/admin/push/subscribe). Keine RLS-INSERT-Policy → niemand kann
-- direkt aus dem Client per anon-Key schreiben.

COMMENT ON TABLE push_subscriptions IS
  'Sprint Functional Modul D Phase 9: Web-Push-Subscriptions. XOR user/stay. MVP nutzt nur user-Pfad (Hotelier-Push); stay-Pfad ist schema-ready für künftigen Gast-Sprint.';
COMMENT ON COLUMN push_subscriptions.stay_id IS
  'Backlog: Gast-Push für Booking-Confirmations etc. — kein Trigger-Code in MVP.';
