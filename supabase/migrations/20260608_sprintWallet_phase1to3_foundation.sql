-- Sprint Wallet · Phasen 1-3 Foundation
--
-- Phase 1: Lib + npm (siehe Code, keine DDL nötig)
-- Phase 2: wallet_passes-Tabelle (CRM-Wallet-Pass)
-- Phase 3: hotels-Branding-Erweiterung für Pass-Klassen (brand_color, hero_image_url)
--
-- WICHTIG: wallet_passes wird EXPLIZIT NICHT vom Auto-Delete-Cron
-- (src/pages/api/cron/auto-delete-stays.ts) angefasst. Der Cron hat eine
-- abschließende Delete-Liste (chat_messages, eve_action_log, bookings,
-- consent_log) — wallet_passes ist nicht enthalten, also schon safe.
-- Sprint Legal Phase 8 hatte das bereits antizipiert (siehe Code-Kommentar).
--
-- DSGVO-Logik: wallet_passes ist eigene Verarbeitungstätigkeit (CRM-Marketing,
-- nicht Stay-Vertragserfüllung). Aufbewahrungsdauer: bis Opt-Out (state =
-- 'opted_out' bleibt für Audit-Beweis erhalten). Anwalts-DSFA wird in
-- Phase 17 / Closing aktualisiert (Vorbedingung Production).

-- ─── Phase 3: hotels-Branding erweitern ────────────────────────────────────

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS brand_color    TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

COMMENT ON COLUMN hotels.brand_color IS
  'Hex-Farbe für Wallet-Pass-hexBackgroundColor und Markenführung allgemein (z.B. "#1A1A1A"). Sprint Wallet Phase 3.';
COMMENT ON COLUMN hotels.hero_image_url IS
  'URL zu 1860×600-Hero-Image für Google Wallet Pass heroImage. Sprint Wallet Phase 3.';

-- ─── Phase 2: wallet_passes ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  guest_first_name TEXT,
  guest_last_name TEXT,

  -- Google-Wallet-spezifisch (NULL bis Pass tatsächlich bei Google angelegt
  -- ist — Approval-Block-Tolerance: Daten können in der DB sitzen während
  -- Issuer-Approval noch läuft)
  google_object_id TEXT UNIQUE,
  google_class_id  TEXT,

  -- Marketing-Consent (DSGVO-konformer Opt-In)
  marketing_consent_given BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_given_at TIMESTAMPTZ,
  marketing_consent_ip_hash TEXT,         -- SHA-256 + STAY_SESSION_SECRET salt (kein Klartext)
  marketing_consent_policy_version TEXT,  -- "2026-06-01" etc.

  -- Wiederkehr-Tracking
  visit_count INT NOT NULL DEFAULT 1,
  first_visit_at TIMESTAMPTZ NOT NULL,
  last_visit_at TIMESTAMPTZ,
  last_pass_open_at TIMESTAMPTZ,          -- Pass im Wallet geöffnet (Webhook)

  -- Lifecycle / Opt-Out
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'opted_out', 'expired')),
  opted_out_at TIMESTAMPTZ,
  opted_out_reason TEXT,
  -- Opt-Out-Source: 'wallet_removed' (Webhook), 'user_unsubscribe' (Link),
  -- 'admin_action' (Hotelier-Cleanup), 'expired' (Cron)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1 Pass pro Email pro Hotel (CRM-Eindeutigkeit)
  UNIQUE(hotel_id, guest_email)
);

CREATE INDEX IF NOT EXISTS idx_wallet_passes_hotel_state
  ON wallet_passes(hotel_id, state);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_email
  ON wallet_passes(guest_email);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_consent
  ON wallet_passes(hotel_id, state, marketing_consent_given)
  WHERE state = 'active' AND marketing_consent_given = true;

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION set_wallet_passes_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_passes_set_updated_at ON wallet_passes;
CREATE TRIGGER wallet_passes_set_updated_at
  BEFORE UPDATE ON wallet_passes
  FOR EACH ROW EXECUTE FUNCTION set_wallet_passes_updated_at();

-- RLS: Hotel-Member dürfen lesen (für /admin/marketing-Pfad, kommt in Modul C);
-- Schreibrechte laufen NUR über Service-Role nach App-Side-Auth-Check.
ALTER TABLE wallet_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read wallet_passes" ON wallet_passes;
CREATE POLICY "Hotel members read wallet_passes"
  ON wallet_passes FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

COMMENT ON TABLE wallet_passes IS
  'Sprint Wallet Phase 2: CRM-Wallet-Pass-Eintrag pro (Hotel × Gast-Email). Dauerhaft (KEIN Auto-Delete via Stay-Cron). Opt-Out setzt state=opted_out aber löscht nicht (Audit-Beweis).';
COMMENT ON COLUMN wallet_passes.marketing_consent_ip_hash IS
  'SHA-256 + STAY_SESSION_SECRET salt — kein Klartext-IP. Pattern wie consent_log/Sprint Legal Phase 2.';
COMMENT ON COLUMN wallet_passes.google_object_id IS
  'Format: ISSUER_ID.pass_<uuid>. NULL solange Pass noch nicht bei Google angelegt (z.B. Issuer-Approval ausstehend).';
