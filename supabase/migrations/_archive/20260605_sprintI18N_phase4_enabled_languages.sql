-- Sprint i18n-Expansion Phase 4 — Hotelier-Sprach-Settings
--
-- hotels.default_language existiert bereits (TEXT DEFAULT 'de').
-- Neu: enabled_languages TEXT[] auf derselben Tabelle.
-- Default = aktuelle 4 hardcoded Sprachen → bestehende Hotels unverändert.
--
-- Briefing Phase 4 Hinweis 3 — Constraints:
--   - max 4 enabled (Mobile-UX-Limit)
--   - default_language MUSS in enabled_languages sein
--   - enabled_languages MÜSSEN valide LanguageCodes sein (eine der 10)
--   - default_language MUSS valide sein

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS enabled_languages TEXT[] NOT NULL
    DEFAULT ARRAY['de','en','fr','es']::TEXT[];

-- default_language Validität (additiv — alte Hotels haben 'de' = valid)
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS check_default_language_valid;
ALTER TABLE hotels
  ADD CONSTRAINT check_default_language_valid
    CHECK (default_language = ANY(ARRAY['de','en','fr','es','it','pt','nl','ru','ar','zh']));

-- enabled_languages: 1-4 Einträge, alle valide
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS check_enabled_languages_count;
ALTER TABLE hotels
  ADD CONSTRAINT check_enabled_languages_count
    CHECK (array_length(enabled_languages, 1) BETWEEN 1 AND 4);

ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS check_enabled_languages_valid;
ALTER TABLE hotels
  ADD CONSTRAINT check_enabled_languages_valid
    CHECK (enabled_languages <@ ARRAY['de','en','fr','es','it','pt','nl','ru','ar','zh']);

-- default_language muss in enabled sein (Inklusion)
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS check_default_in_enabled;
ALTER TABLE hotels
  ADD CONSTRAINT check_default_in_enabled
    CHECK (default_language = ANY(enabled_languages));

COMMENT ON COLUMN hotels.enabled_languages IS
  'Sprint i18n: Sprachen die der Gast im Sprach-Selector des /g-Frontends sieht. Max 4 (Mobile-UX). default_language muss enthalten sein. Auto-Übersetzungen funktionieren für alle 10.';

COMMENT ON COLUMN hotels.default_language IS
  'Sprint i18n: Sprache in der der Hotelier seine i18n-Felder pflegt. Auto-Translation füllt die anderen 9. Fallback-Ziel beim pickI18n() (User-Sprache → default_language → DE-Global → "").';
