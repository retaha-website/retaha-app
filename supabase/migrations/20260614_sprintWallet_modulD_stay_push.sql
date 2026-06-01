-- Sprint Wallet · Modul D — Stay-spezifische Push-Templates
--
-- 2 Tabellen + Backfill-Defaults für alle bestehenden Hotels.
--
-- Trigger-Typen (9, einer davon zeit-getriggert):
--   welcome, service_confirmed, service_declined, late_checkout_approved,
--   restaurant_reservation, spa_reservation, housekeeping_done, room_ready,
--   checkout_reminder
--
-- DSGVO: Stay-Pushes laufen unter Art. 6 Abs. 1 lit. b (Vertragserfüllung
-- während Aufenthalt) — canSendPush(pass, 'service') ignoriert opted_out
-- aber blockiert state=expired.

CREATE TABLE IF NOT EXISTS stay_push_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'welcome', 'service_confirmed', 'service_declined',
    'late_checkout_approved', 'restaurant_reservation',
    'spa_reservation', 'housekeeping_done', 'room_ready',
    'checkout_reminder'
  )),
  title_i18n JSONB NOT NULL,
  body_i18n JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hotel_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_stay_push_templates_hotel
  ON stay_push_templates(hotel_id, trigger_type) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS stay_push_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_pass_id UUID NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  failed_reason TEXT,
  lang_used CHAR(2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotenz via 2 partial Indizes:
--   1. Trigger ohne booking_id (welcome, checkout_reminder, room_ready, etc.) → 1× pro (stay, trigger)
--   2. Trigger mit booking_id (service_confirmed/declined etc.) → 1× pro (stay, trigger, booking)
-- Postgres UNIQUE-Index behandelt NULL als not-equal — daher 2 separate Indizes statt 1.
DROP INDEX IF EXISTS uniq_stay_push_idempotent_no_booking;
DROP INDEX IF EXISTS uniq_stay_push_idempotent_with_booking;
CREATE UNIQUE INDEX uniq_stay_push_idempotent_no_booking
  ON stay_push_sends(stay_id, trigger_type)
  WHERE stay_id IS NOT NULL AND booking_id IS NULL;
CREATE UNIQUE INDEX uniq_stay_push_idempotent_with_booking
  ON stay_push_sends(stay_id, trigger_type, booking_id)
  WHERE stay_id IS NOT NULL AND booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stay_push_sends_pass ON stay_push_sends(wallet_pass_id, sent_at DESC);

CREATE OR REPLACE FUNCTION set_stay_push_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS stay_push_templates_updated_at ON stay_push_templates;
CREATE TRIGGER stay_push_templates_updated_at BEFORE UPDATE ON stay_push_templates
  FOR EACH ROW EXECUTE FUNCTION set_stay_push_updated_at();

ALTER TABLE stay_push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE stay_push_sends     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read stay_push_templates" ON stay_push_templates;
CREATE POLICY "Hotel members read stay_push_templates" ON stay_push_templates FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read stay_push_sends" ON stay_push_sends;
CREATE POLICY "Hotel members read stay_push_sends" ON stay_push_sends FOR SELECT
  USING (wallet_pass_id IN (SELECT id FROM wallet_passes WHERE hotel_id IN (SELECT user_hotel_ids())));

COMMENT ON TABLE stay_push_templates IS
  'Sprint Wallet Modul D: pro Hotel pro Trigger-Typ ein editierbares Template. UNIQUE(hotel_id, trigger_type).';
COMMENT ON TABLE stay_push_sends IS
  'Sprint Wallet Modul D: Audit + Idempotenz für Stay-Push-Sends. Service-Push (Vertragserfüllung), respektiert opt_out nicht.';

-- ─── Default-Templates für alle bestehenden Hotels ────────────────────
-- Für jedes Hotel × jeden Trigger-Typ wird ein Default-Eintrag angelegt
-- wenn nicht schon vorhanden (ON CONFLICT DO NOTHING auf UNIQUE).
-- Sprachen: nur DE als 'original' — Auto-Translate läuft beim ersten Edit.

DO $$
DECLARE h RECORD;
        defaults JSONB;
        item JSONB;
        ts TEXT := NOW()::TEXT;
BEGIN
  defaults := '[
    {"t": "welcome",                "title": "Willkommen im {{hotel_name}}!",         "body": "Schön dass du da bist, {{first_name}}. Bei Fragen ist Eve immer für dich da."},
    {"t": "service_confirmed",      "title": "Deine Anfrage ist bestätigt",          "body": "Wir kümmern uns um deinen Wunsch."},
    {"t": "service_declined",       "title": "Wir können das leider nicht erfüllen", "body": "Bitte sprich uns gern persönlich an — wir finden eine Lösung."},
    {"t": "late_checkout_approved", "title": "Late-Checkout bestätigt",              "body": "Du kannst dein Zimmer bis {{checkout_time}} nutzen."},
    {"t": "restaurant_reservation", "title": "Restaurant-Reservierung bestätigt",    "body": "{{guest_count}} Gäste am {{date}} um {{time}}."},
    {"t": "spa_reservation",        "title": "Spa-Termin bestätigt",                 "body": "Wir freuen uns auf dich am {{date}} um {{time}}."},
    {"t": "housekeeping_done",      "title": "Dein Zimmer ist hergerichtet",         "body": "Schön, wenn du bald wieder da bist."},
    {"t": "room_ready",             "title": "Dein Zimmer ist bereit",               "body": "Du kannst jederzeit einchecken."},
    {"t": "checkout_reminder",      "title": "Eine Stunde bis zum Check-out",        "body": "Bei Fragen ist Eve da. Wir wünschen dir eine gute Heimreise!"}
  ]'::JSONB;

  FOR h IN SELECT id FROM hotels LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(defaults) LOOP
      INSERT INTO stay_push_templates (hotel_id, trigger_type, title_i18n, body_i18n)
      VALUES (
        h.id,
        item->>'t',
        jsonb_build_object('de', jsonb_build_object('value', item->>'title', 'source', 'original', 'updated_at', ts)),
        jsonb_build_object('de', jsonb_build_object('value', item->>'body',  'source', 'original', 'updated_at', ts))
      )
      ON CONFLICT (hotel_id, trigger_type) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
