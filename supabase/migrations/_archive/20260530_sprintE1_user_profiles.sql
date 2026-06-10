-- Sprint E1 · Phase 7 — User-Profile für personalisierte Anrede
-- ========================================================================
-- Wizard fragt nach Wizard-Start nach Vor/Nachname des Admins. Pre-Pilot-
-- Polish damit Mails "Hallo Kristin," sagen können statt "Hallo!".
--
-- 1:1-Tabelle zu auth.users (user_id als PK). CASCADE-Delete bei User-Löschung.
-- RLS: User sieht/bearbeitet nur seinen eigenen Eintrag.
-- ========================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
CREATE POLICY "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_upsert_own_profile" ON user_profiles;
CREATE POLICY "users_upsert_own_profile"
  ON user_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE user_profiles IS
  'Admin-Profil-Daten (Vor/Nachname) für personalisierte Mail-Anrede. 1:1 zu auth.users, RLS owner-only.';
