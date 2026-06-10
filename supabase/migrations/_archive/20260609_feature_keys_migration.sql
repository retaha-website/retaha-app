-- Migration: legacy feature keys → new schema keys
-- Executed manually via Supabase Management API on 2026-06-09
--
-- Old keys (from early Sprint):   concierge_chat, berlin_tips, service_requests,
--                                   breakfast_reservation, conference_booking,
--                                   checkout_flow, wallet_card
-- New keys (code checks for):     eve, recommendations, service, breakfast,
--                                   conference, self_checkout, wallet

-- Step 1: Merge new keys (with COALESCE fallback from old keys)
UPDATE hotel_settings
SET features = COALESCE(features, '{}'::jsonb)
  || jsonb_build_object(
    'eve',             COALESCE((features->>'concierge_chat')::bool, true),
    'recommendations', COALESCE((features->>'berlin_tips')::bool, true),
    'service',         COALESCE((features->>'service_requests')::bool, true),
    'breakfast',       COALESCE((features->>'breakfast_reservation')::bool, true),
    'conference',      COALESCE((features->>'conference_booking')::bool, true),
    'self_checkout',   COALESCE((features->>'checkout_flow')::bool, true),
    'wallet',          COALESCE((features->>'wallet_card')::bool, true),
    'action_cards',    true,
    'wifi',            true,
    'loyalty',         false,
    'feedback',        false
  )
WHERE features IS NOT NULL;

-- Step 2: Remove legacy keys
UPDATE hotel_settings
SET features = features
  - 'concierge_chat'
  - 'berlin_tips'
  - 'service_requests'
  - 'breakfast_reservation'
  - 'conference_booking'
  - 'checkout_flow'
  - 'wallet_card'
WHERE features IS NOT NULL;
