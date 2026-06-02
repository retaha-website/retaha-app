-- Sprint F · Dev-Login-Migration
--
-- DEV-ONLY — NICHT auf Production rollen!
-- Naming-Convention `dev_*` ist Signal für manual-skip beim Production-Deploy.
--
-- Erstellt:
--   - 3 Test-User in auth.users (owner/manager/staff @retaha.de)
--   - 1 Test-Hotel "Test Hotel (Dev)" mit Showcase-fähigem Setup
--   - 3 hotel_users-Einträge mit Rollen (owner, manager, staff)
--   - onboarding_state mit ALLEN step_* = true (komplett-onboarded)
--
-- Re-runnable: ON CONFLICT DO NOTHING / DO UPDATE für Idempotenz.
--
-- Verwendung mit /dev-login UI (apps/auth/src/pages/dev-login.astro):
--   1. owner@retaha.de  → Owner full-access auf Test Hotel (Dev)
--   2. manager@retaha.de → Manager
--   3. staff@retaha.de  → Staff

DO $$
DECLARE
  v_hotel_id UUID := 'e1f30ac0-17e1-47b6-9bda-487e14b07628';
  v_owner_id UUID;
  v_manager_id UUID;
  v_staff_id UUID;
BEGIN
  ---------------------------------------------------------------
  -- Test-User in auth.users
  ---------------------------------------------------------------
  -- Owner
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'owner@retaha.de';
  IF v_owner_id IS NULL THEN
    v_owner_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current
    ) VALUES (
      v_owner_id, '00000000-0000-0000-0000-000000000000',
      'owner@retaha.de', NOW(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Dev","last_name":"Owner"}'::jsonb,
      NOW(), NOW(), '', '', '', '', ''
    );
  END IF;

  -- Manager
  SELECT id INTO v_manager_id FROM auth.users WHERE email = 'manager@retaha.de';
  IF v_manager_id IS NULL THEN
    v_manager_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current
    ) VALUES (
      v_manager_id, '00000000-0000-0000-0000-000000000000',
      'manager@retaha.de', NOW(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Dev","last_name":"Manager"}'::jsonb,
      NOW(), NOW(), '', '', '', '', ''
    );
  END IF;

  -- Staff
  SELECT id INTO v_staff_id FROM auth.users WHERE email = 'staff@retaha.de';
  IF v_staff_id IS NULL THEN
    v_staff_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current
    ) VALUES (
      v_staff_id, '00000000-0000-0000-0000-000000000000',
      'staff@retaha.de', NOW(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Dev","last_name":"Staff"}'::jsonb,
      NOW(), NOW(), '', '', '', '', ''
    );
  END IF;

  ---------------------------------------------------------------
  -- Test-Hotel
  ---------------------------------------------------------------
  -- Minimal-INSERT mit den essentiellen Columns. Andere optional-Columns
  -- (address, postal_code etc. aus sprintE2_hotels_address) bleiben NULL
  -- bzw. auf ihren DEFAULTs.
  -- Schema-Note (via MCP verifiziert): hotels hat KEIN updated_at column.
  -- Spalten: id, slug, name, city, country, timezone, default_language,
  -- created_at, is_active, trial_started_at, subscription_status, stripe_*,
  -- logo_url, address_street, address_zip, latitude, longitude,
  -- enabled_languages, brand_color, hero_image_url, theme.
  INSERT INTO hotels (
    id, name, slug, theme, default_language, city,
    subscription_status, trial_started_at,
    created_at
  ) VALUES (
    v_hotel_id,
    'Test Hotel (Dev)',
    'test-hotel-dev',
    'bauhaus_manufaktur',
    'de',
    'Berlin',
    'active',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    theme = EXCLUDED.theme,
    subscription_status = EXCLUDED.subscription_status;

  ---------------------------------------------------------------
  -- hotel_users: Rollen-Mapping
  ---------------------------------------------------------------
  -- Schema-Note: hotel_users UNIQUE-Constraint ist (user_id, hotel_id),
  -- nicht (hotel_id, user_id). Reihenfolge im ON CONFLICT matters.
  INSERT INTO hotel_users (hotel_id, user_id, role, invited_at, accepted_at, created_at)
  VALUES
    (v_hotel_id, v_owner_id,   'owner',   NOW(), NOW(), NOW()),
    (v_hotel_id, v_manager_id, 'manager', NOW(), NOW(), NOW()),
    (v_hotel_id, v_staff_id,   'staff',   NOW(), NOW(), NOW())
  ON CONFLICT (user_id, hotel_id) DO UPDATE SET
    role = EXCLUDED.role,
    accepted_at = COALESCE(hotel_users.accepted_at, EXCLUDED.accepted_at);

  ---------------------------------------------------------------
  -- onboarding_state: alle Steps abgeschlossen
  ---------------------------------------------------------------
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
  ) ON CONFLICT (hotel_id) DO UPDATE SET
    step_account       = true,
    step_hotel_basics  = true,
    step_address       = true,
    step_languages     = true,
    step_mews          = true,
    step_wifi          = true,
    step_breakfast     = true,
    step_eve_knowledge = true,
    step_action_cards  = true,
    step_team_invited  = true,
    completed_at       = COALESCE(onboarding_state.completed_at, NOW()),
    updated_at         = NOW();

  RAISE NOTICE 'Dev test users created: owner=%, manager=%, staff=%',
    v_owner_id, v_manager_id, v_staff_id;
  RAISE NOTICE 'Dev test hotel: % (Test Hotel (Dev))', v_hotel_id;
END $$;
