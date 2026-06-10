-- Sprint-I Findings-Fix · 2FA-System
-- Tabellen:
--   user_mfa                 — TOTP-Konfiguration pro User (Secret verschluesselt)
--   user_mfa_recovery_codes  — 8 Recovery-Codes pro User (bcrypt-hash, single-use)
--   mfa_audit_log            — Sicherheits-Historie (DSGVO + Compliance)
-- Hotel-Enforcement: 3 Spalten auf hotels fuer Owner-Policy.
-- RLS: jeder User sieht nur eigene Records.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. USER_MFA: TOTP-Konfiguration pro User
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE public.user_mfa (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- AES-256-GCM verschluesselt, Format: iv.tag.ciphertext (base64url)
  secret_encrypted TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- erst nach erfolgreicher 6-stelliger Code-Verifizierung waehrend Setup
  verified_at TIMESTAMPTZ,
  -- Owner-Praeferenz: bei Magic-Link-Login auch MFA verlangen?
  require_on_magic_link BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_mfa IS 'TOTP-Konfiguration pro User. Secret AES-256-GCM verschluesselt via MFA_ENCRYPTION_KEY.';
COMMENT ON COLUMN public.user_mfa.secret_encrypted IS 'Base32 TOTP-Secret, verschluesselt mit MFA_ENCRYPTION_KEY (siehe packages/auth/mfa/encryption.ts)';

-- ════════════════════════════════════════════════════════════════════
-- 2. USER_MFA_RECOVERY_CODES: 8 Backup-Codes pro User
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE public.user_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- bcrypt cost-10 Hash, nie Klartext speichern
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_recovery_user ON public.user_mfa_recovery_codes(user_id);
CREATE INDEX idx_mfa_recovery_unused ON public.user_mfa_recovery_codes(user_id) WHERE used_at IS NULL;

COMMENT ON TABLE public.user_mfa_recovery_codes IS '8 single-use Backup-Codes pro User. Format Klartext: XXXX-XXXX (8 alphanumerische Zeichen). DB-Storage: bcrypt cost-10 Hash.';

-- ════════════════════════════════════════════════════════════════════
-- 3. HOTELS.mfa_required_for_team: Owner-Enforcement-Policy
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.hotels ADD COLUMN mfa_required_for_team BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.hotels ADD COLUMN mfa_required_set_at TIMESTAMPTZ;
ALTER TABLE public.hotels ADD COLUMN mfa_required_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.hotels.mfa_required_for_team IS 'Owner-Policy: true zwingt alle Hotel-Members zu MFA-Setup. Pending Users werden bei Login auf /admin/sicherheit redirected.';

-- ════════════════════════════════════════════════════════════════════
-- 4. MFA_AUDIT_LOG: Sicherheits-Historie (DSGVO-Pflicht)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE public.mfa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Bei Owner-Policy-Change auch hotel_id loggen (Audit-Pflicht)
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- 'setup_started' | 'setup_completed' | 'code_verified' | 'code_failed'
  -- | 'recovery_used' | 'disabled' | 'team_policy_changed' | 'low_recovery_warning'
  event_type TEXT NOT NULL,
  -- Pseudonymisierung: KEINE IP, nur country_code + user_agent_family.
  -- Beispiel: { "country": "DE", "ua_family": "Safari", "device": "mobile" }
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_audit_user_time ON public.mfa_audit_log(user_id, created_at DESC);
CREATE INDEX idx_mfa_audit_event_type ON public.mfa_audit_log(event_type, created_at DESC);

COMMENT ON TABLE public.mfa_audit_log IS 'MFA-Events fuer Sicherheits-Historie + DSGVO-Audit. Pseudonymisiert (kein IP, nur country_code).';

-- ════════════════════════════════════════════════════════════════════
-- 5. UPDATED_AT TRIGGER fuer user_mfa
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at_user_mfa()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_mfa_updated_at
  BEFORE UPDATE ON public.user_mfa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_user_mfa();

-- ════════════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_audit_log ENABLE ROW LEVEL SECURITY;

-- User darf eigene MFA-Config lesen + schreiben
CREATE POLICY "users manage own mfa"
  ON public.user_mfa
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User darf eigene Recovery-Codes lesen + schreiben
CREATE POLICY "users manage own recovery codes"
  ON public.user_mfa_recovery_codes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User darf eigene Audit-Logs LESEN (nicht schreiben — das macht service_role)
CREATE POLICY "users read own mfa audit"
  ON public.mfa_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- service_role darf alles (App-Side Audit-Writes nach Auth-Check)
-- (kein explicit policy noetig, bypassrls=true bei service_role)

COMMIT;
