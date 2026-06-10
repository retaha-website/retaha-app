-- Sprint Wallet · Phase 8 — Marketing-Tool-Schema (Mini-Mailchimp)
--
-- 6 Tabellen für ein vollständiges Marketing-System:
--   marketing_templates       — wiederverwendbare Vorlagen (i18n)
--   marketing_campaigns       — konkrete Send-Aktionen (Send-Now oder Scheduled)
--   marketing_sends           — per-Recipient-Tracking + Analytics
--   marketing_drips           — Drip-Sequenzen (6 Trigger-Typen)
--   marketing_drip_steps      — Steps innerhalb einer Drip-Sequenz
--   marketing_drip_state      — pro-Pass-Idempotenz (welche Steps schon gesendet)
--
-- i18n-Pattern: JSONB { de: {value, source}, en: {value, source}, ... }
-- wie Action-Cards / Welcome-Message aus i18n-Sprint.
--
-- RLS: alle Tabellen NUR für Hotel-Members des hotels lesbar. Writes laufen
-- via Service-Role nach App-Side-Auth-Check (Permission: content.write).

-- ─── 1. marketing_templates ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- Hotelier-interne Bezeichnung

  title_i18n      JSONB NOT NULL,           -- { de: {value,source,updated_at}, en: ... }
  body_i18n       JSONB NOT NULL,           -- HTML aus TipTap (sanitized)
  cta_label_i18n  JSONB,                    -- optional, nullable wenn kein CTA
  cta_url         TEXT,                     -- absolute URL des CTA-Buttons
  hero_image_url  TEXT,                     -- optional, Supabase Storage

  category TEXT,                            -- 'newsletter','event','promotion','seasonal'
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_templates_hotel
  ON marketing_templates(hotel_id, is_archived, updated_at DESC);

-- ─── 2. marketing_campaigns ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  template_id UUID REFERENCES marketing_templates(id) ON DELETE SET NULL,
  -- template_id nullable: Ad-hoc Campaigns ohne Template möglich

  name TEXT NOT NULL,

  title_i18n      JSONB NOT NULL,
  body_i18n       JSONB NOT NULL,
  cta_label_i18n  JSONB,
  cta_url         TEXT,
  hero_image_url  TEXT,

  target_filter JSONB,                      -- z.B. { language: 'de', min_visit_count: 2 }

  scheduled_at TIMESTAMPTZ,                 -- NULL = send-now via UI-Trigger
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,

  -- Denormalized Stats für schnelle Dashboard-Anzeige
  recipients_count INT NOT NULL DEFAULT 0,
  open_count INT NOT NULL DEFAULT 0,
  click_count INT NOT NULL DEFAULT 0,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_hotel_status
  ON marketing_campaigns(hotel_id, status, scheduled_at);

-- ─── 3. marketing_sends ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  wallet_pass_id UUID NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ,                      -- NULL bis tatsächlich rausgegangen
  delivered BOOLEAN,                        -- nullable: ohne Webhook-Bestätigung unbekannt
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_reason TEXT,
  lang_used CHAR(2),                        -- welche Sprach-Variante geliefert wurde

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, wallet_pass_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign ON marketing_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_pass ON marketing_sends(wallet_pass_id, sent_at DESC);

-- ─── 4. marketing_drips ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_drips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- 6 Trigger-Typen (statt 4 aus Briefing-Vorgabe):
  --   wallet_add             — sofort beim Add-to-Wallet
  --   first_visit            — bei erstem Stay-Sync mit dieser Email
  --   checkout               — bei jedem Check-out
  --   anniversary            — jährlich am first_visit_at
  --   visit_count_milestone  — bei n-tem Besuch (config: { milestones: [5,10,25] })
  --   seasonal               — datumsbasiert (config: { month: 12, day: 24 })
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'wallet_add', 'first_visit', 'checkout', 'anniversary',
    'visit_count_milestone', 'seasonal'
  )),
  trigger_config JSONB,                     -- typ-spezifische Config (siehe oben)

  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_drips_hotel_active
  ON marketing_drips(hotel_id, is_active);

-- ─── 5. marketing_drip_steps ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_drip_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_id UUID NOT NULL REFERENCES marketing_drips(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES marketing_templates(id) ON DELETE RESTRICT,
  -- ON DELETE RESTRICT: ein Template das in einer Drip-Sequenz hängt darf
  -- nicht hard-deleted werden — Hotelier muss zuerst die Sequenz auflösen

  delay_days INT NOT NULL CHECK (delay_days >= 0),
  step_order INT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(drip_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_drip_steps_drip ON marketing_drip_steps(drip_id, step_order);

-- ─── 6. marketing_drip_state ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_drip_state (
  drip_id UUID NOT NULL REFERENCES marketing_drips(id) ON DELETE CASCADE,
  wallet_pass_id UUID NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL,
  last_step_sent INT NOT NULL DEFAULT 0,

  PRIMARY KEY (drip_id, wallet_pass_id)
);

CREATE INDEX IF NOT EXISTS idx_drip_state_next
  ON marketing_drip_state(drip_id, triggered_at) WHERE last_step_sent < 999;

-- ─── updated_at-Triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_marketing_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketing_templates_updated_at ON marketing_templates;
CREATE TRIGGER marketing_templates_updated_at
  BEFORE UPDATE ON marketing_templates
  FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();

DROP TRIGGER IF EXISTS marketing_campaigns_updated_at ON marketing_campaigns;
CREATE TRIGGER marketing_campaigns_updated_at
  BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();

DROP TRIGGER IF EXISTS marketing_drips_updated_at ON marketing_drips;
CREATE TRIGGER marketing_drips_updated_at
  BEFORE UPDATE ON marketing_drips
  FOR EACH ROW EXECUTE FUNCTION set_marketing_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE marketing_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sends      ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_drips      ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_drip_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members read marketing_templates" ON marketing_templates;
CREATE POLICY "Hotel members read marketing_templates"
  ON marketing_templates FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read marketing_campaigns" ON marketing_campaigns;
CREATE POLICY "Hotel members read marketing_campaigns"
  ON marketing_campaigns FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read marketing_sends" ON marketing_sends;
CREATE POLICY "Hotel members read marketing_sends"
  ON marketing_sends FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM marketing_campaigns WHERE hotel_id IN (SELECT user_hotel_ids())
  ));

DROP POLICY IF EXISTS "Hotel members read marketing_drips" ON marketing_drips;
CREATE POLICY "Hotel members read marketing_drips"
  ON marketing_drips FOR SELECT
  USING (hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read marketing_drip_steps" ON marketing_drip_steps;
CREATE POLICY "Hotel members read marketing_drip_steps"
  ON marketing_drip_steps FOR SELECT
  USING (drip_id IN (
    SELECT id FROM marketing_drips WHERE hotel_id IN (SELECT user_hotel_ids())
  ));

DROP POLICY IF EXISTS "Hotel members read marketing_drip_state" ON marketing_drip_state;
CREATE POLICY "Hotel members read marketing_drip_state"
  ON marketing_drip_state FOR SELECT
  USING (drip_id IN (
    SELECT id FROM marketing_drips WHERE hotel_id IN (SELECT user_hotel_ids())
  ));

-- ─── Kommentare ─────────────────────────────────────────────────────────────

COMMENT ON TABLE marketing_templates IS
  'Sprint Wallet Phase 8: wiederverwendbare Marketing-Vorlagen. i18n via JSONB. Body ist sanitized TipTap-HTML.';
COMMENT ON TABLE marketing_campaigns IS
  'Sprint Wallet Phase 8: konkrete Send-Aktionen. Kopiert ggf. von Template oder Ad-hoc. Status-Lifecycle draft→scheduled→sending→sent.';
COMMENT ON TABLE marketing_sends IS
  'Sprint Wallet Phase 8: per-Recipient-Tracking inkl. Open/Click-Timestamps. UNIQUE(campaign,pass) verhindert Doppel-Send.';
COMMENT ON TABLE marketing_drips IS
  'Sprint Wallet Phase 8: Drip-Sequenzen mit 6 Trigger-Typen. trigger_config für typ-spezifische Parameter (Milestones, Datum, etc.).';
COMMENT ON TABLE marketing_drip_state IS
  'Sprint Wallet Phase 8: Idempotenz-Tracking pro (drip,pass). Cron iteriert über diese Tabelle und sendet nächsten Step wenn delay_days erreicht.';
