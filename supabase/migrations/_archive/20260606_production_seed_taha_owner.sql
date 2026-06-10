-- Sprint G Phase 3 · Production-Seed: taha.uenal@retaha.de + retaha-Manufaktur-Test-Hotel
--
-- PRODUCTION-MIGRATION — wird auf Production-Supabase (twmzhrcadixzcdlupisd) appliziert.
--
-- Pattern adaptiert aus 20260602_dev_test_users.sql:
--   - NUR 1 User (Owner), nicht 3
--   - Email taha.uenal@retaha.de (Workspace, nicht iCloud)
--   - Hotel-UUID via gen_random_uuid() (NEU, NICHT die Dev-UUID e1f30ac0-...)
--   - Hotel-Name "retaha Manufaktur (Production-Test)" klar als Prod-Test erkennbar
--   - Slug "retaha-manufaktur-prod" konsistent
--   - Default-Theme bauhaus_manufaktur (Pink-Shock-Akzent)
--   - onboarding_state: alle Steps = true (Owner muss nichts mehr wizard-mäßig durchgehen)
--
-- Idempotenz-Philosophie (Option B nach User-Review):
--   - auth.users:        IDEMPOTENT (SELECT + IF NULL — User kann bereits via
--                        Magic-Link manuell angelegt sein, dann reuse)
--   - hotels + hotel_users + onboarding_state: SIMPLE INSERT, KEIN ON CONFLICT
--                        Re-Run failt loud bei UNIQUE-Verletzung. Migration-Tracker
--                        (supabase_migrations.schema_migrations) verhindert
--                        Doppel-Apply normalerweise — wenn die Migration trotzdem
--                        2x läuft, ist das ein Bug, der bemerkt werden soll.
--
-- Schema-Note (dev_test_users.sql Z.89): hotels hat KEIN updated_at column.

DO $$
DECLARE
  v_hotel_id UUID := gen_random_uuid();
  v_owner_id UUID;
BEGIN
  ---------------------------------------------------------------
  -- Owner-User in auth.users (IDEMPOTENT)
  ---------------------------------------------------------------
  -- User kann theoretisch schon via Magic-Link manuell registriert sein
  -- (über send-magic-link API). In dem Fall: reuse seine ID.
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'taha.uenal@retaha.de';

  IF v_owner_id IS NULL THEN
    v_owner_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current
    ) VALUES (
      v_owner_id, '00000000-0000-0000-0000-000000000000',
      'taha.uenal@retaha.de', NOW(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Taha","last_name":"Ünal"}'::jsonb,
      NOW(), NOW(), '', '', '', '', ''
    );
  END IF;

  ---------------------------------------------------------------
  -- Production-Test-Hotel (SIMPLE INSERT — fail-loud bei Re-Run)
  ---------------------------------------------------------------
  -- Spalten verifiziert aus dev_test_users.sql Schema-Note:
  -- id, slug, name, city, country, timezone, default_language,
  -- created_at, is_active, trial_started_at, subscription_status,
  -- enabled_languages, brand_color, theme. KEIN updated_at.
  INSERT INTO hotels (
    id, name, slug, theme, default_language, city,
    subscription_status, trial_started_at,
    created_at
  ) VALUES (
    v_hotel_id,
    'retaha Manufaktur (Production-Test)',
    'retaha-manufaktur-prod',
    'bauhaus_manufaktur',
    'de',
    'Niedernhall',
    'active',
    NOW(),
    NOW()
  );

  ---------------------------------------------------------------
  -- hotel_users: Owner-Role
  ---------------------------------------------------------------
  -- Schema-Note: UNIQUE-Constraint ist (user_id, hotel_id).
  INSERT INTO hotel_users (hotel_id, user_id, role, invited_at, accepted_at, created_at)
  VALUES (v_hotel_id, v_owner_id, 'owner', NOW(), NOW(), NOW());

  ---------------------------------------------------------------
  -- onboarding_state: alle Steps abgeschlossen
  ---------------------------------------------------------------
  -- Owner soll im Backoffice direkt landen, nicht in Wizard.
  -- Echte Production-Hotels (Kristin) bekommen onboarding_state mit
  -- step_* = false via create_hotel_with_owner-RPC.
  INSERT INTO onboarding_state (
    hotel_id,
    step_account, step_hotel_basics, step_address, step_languages,
    step_mews, step_wifi, step_breakfast, step_eve_knowledge,
    step_action_cards, step_team_invited,
    completed_at, created_at, updated_at
  ) VALUES (
    v_hotel_id,
    true, true, true, true, true, true, true, true, true, true,
    NOW(), NOW(), NOW()
  );

  RAISE NOTICE 'Production-Seed: owner=% (taha.uenal@retaha.de)', v_owner_id;
  RAISE NOTICE 'Production-Seed: hotel=% (retaha Manufaktur (Production-Test))', v_hotel_id;
END $$;
