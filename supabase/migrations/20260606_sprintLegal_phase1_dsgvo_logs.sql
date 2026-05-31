-- Sprint Legal/DSGVO Phase 1 — Audit-Logs für Consent, Löschung, Export
--
-- 3 Tabellen für DSGVO-Nachweispflichten (Art. 7 Consent, Art. 17 Löschung,
-- Art. 15 Auskunft). Alle mit RLS analog der anderen Tabellen.
--
-- Wichtige Design-Entscheidungen (siehe Briefing + Phase-0-Discovery):
--   - consent_log.ip_hash: SHA-256 mit Server-Salt (STAY_SESSION_SECRET wiederverwendet
--     wenn vorhanden, sonst Fixed-Salt). Nachweis der Zustimmung ohne personenbezogene
--     Klartext-IP.
--   - deletion_log.subject_type CHECK reflektiert Mews-Lösch-Realität: Stay-Stammdaten
--     sind Mews-Source-of-Truth → KEIN 'stay_full' Wert. Realistisch löschbar sind nur
--     App-spezifische Daten (eve_conversations, app_data).
--   - subject_ref anonymisiert (Hash, nicht Klartext-Name) — Audit ohne Re-Identifikation.
--   - records_deleted JSONB: { table_name: count } für Art.-17-Nachweis.

-- ── consent_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id       UUID REFERENCES stays(id) ON DELETE SET NULL,
  -- nullable: anonyme Visits vor Pairing oder Hotelier-Login
  hotel_id      UUID REFERENCES hotels(id) ON DELETE CASCADE,
  consent_type  TEXT NOT NULL CHECK (consent_type IN (
    'necessary',    -- nur technisch notwendige Cookies
    'analytics',    -- + Analyse (aktuell keine, präventiv vorbereitet)
    'all',          -- alle akzeptiert
    'rejected',     -- explizit alles abgelehnt (außer notwendige)
    'updated'       -- nachträgliche Änderung der Präferenz
  )),
  consent_given BOOLEAN NOT NULL,
  ip_hash       TEXT,            -- SHA-256 + Server-Salt, NIE Klartext
  user_agent    TEXT,
  policy_version TEXT,            -- für spätere Re-Consent-Notwendigkeit bei Policy-Änderung
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_stay ON consent_log(stay_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_hotel ON consent_log(hotel_id, created_at DESC);

COMMENT ON TABLE consent_log IS
  'Sprint Legal Phase 1: DSGVO Art. 7 Nachweis der Cookie/Tracking-Zustimmung. IP nur gehasht (SHA-256 + Server-Salt) gespeichert.';
COMMENT ON COLUMN consent_log.ip_hash IS
  'SHA-256 Hash von IP + STAY_SESSION_SECRET. Nicht reverse-engineerbar. Erlaubt Erkennung wiederholter Consent-Wechsel vom selben Nutzer ohne Klartext-IP.';

-- ── deletion_log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
  subject_type    TEXT NOT NULL CHECK (subject_type IN (
    'eve_conversations',  -- chat_messages eines Stays gelöscht (Art. 17)
    'app_data',           -- bookings + eve_action_log eines Stays
    'auto_checkout',      -- Cron-Job nach N Tagen Checkout
    'guest_request',      -- Gast-Self-Service Art. 17
    'hotelier_request',   -- Hotelier hat im Auftrag des Gastes gelöscht
    'retention'           -- generelle Aufbewahrungsfrist abgelaufen
  )),
  subject_ref     TEXT,            -- anonymisierte Referenz (z.B. SHA-256(stay_id))
  deletion_reason TEXT,            -- Free-Text-Begründung
  records_deleted JSONB,           -- { "chat_messages": 12, "bookings": 3, ... }
  triggered_by    TEXT,            -- 'gast', 'hotelier', 'cron', 'admin'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_log_hotel ON deletion_log(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_log_type  ON deletion_log(subject_type, created_at DESC);

COMMENT ON TABLE deletion_log IS
  'Sprint Legal Phase 1: DSGVO Art. 17 Nachweis von Lösch-Vorgängen. subject_type kennt KEIN stay_full — Stay-Stammdaten kommen aus Mews und können von der App nicht endgültig gelöscht werden.';

-- ── data_export_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_export_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id       UUID REFERENCES stays(id) ON DELETE SET NULL,
  hotel_id      UUID REFERENCES hotels(id) ON DELETE SET NULL,
  export_format TEXT NOT NULL DEFAULT 'json' CHECK (export_format IN ('json', 'csv')),
  bytes_exported INTEGER,
  ip_hash       TEXT,
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_export_log_stay ON data_export_log(stay_id, exported_at DESC);

COMMENT ON TABLE data_export_log IS
  'Sprint Legal Phase 1: DSGVO Art. 15 Nachweis erteilter Datenauskünfte. Speichert nicht die exportierten Daten selbst — nur dass + wann exportiert wurde.';

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE consent_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_log ENABLE ROW LEVEL SECURITY;

-- Hotelier sieht nur seine eigenen Logs (Audit-Zugriff)
DROP POLICY IF EXISTS "Hotel members read consent_log" ON consent_log;
CREATE POLICY "Hotel members read consent_log"
  ON consent_log FOR SELECT
  USING (hotel_id IS NULL OR hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read deletion_log" ON deletion_log;
CREATE POLICY "Hotel members read deletion_log"
  ON deletion_log FOR SELECT
  USING (hotel_id IS NULL OR hotel_id IN (SELECT user_hotel_ids()));

DROP POLICY IF EXISTS "Hotel members read export_log" ON data_export_log;
CREATE POLICY "Hotel members read export_log"
  ON data_export_log FOR SELECT
  USING (hotel_id IS NULL OR hotel_id IN (SELECT user_hotel_ids()));

-- INSERT/UPDATE/DELETE: nur Service-Role (Endpoints und Cron schreiben).
-- Kein authenticated-INSERT — der Gast hat keine User-Session, der Cookie-
-- Banner-Endpoint nutzt Service-Role nach Stay-Token-Verifikation.
-- (Service-Role bypasst RLS sowieso → keine explicit Policy nötig.)
