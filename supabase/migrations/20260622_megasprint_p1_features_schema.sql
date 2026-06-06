-- Phase 1 (Mega-Sprint Tag 19): hotel_settings.features auf 25 Module erweitern
-- Neue kanonische Keys (ohne _enabled-Suffix), Legacy-Keys bleiben für Rückwärtskompatibilität

-- Neuer Default mit allen Modulen
ALTER TABLE hotel_settings
  ALTER COLUMN features SET DEFAULT '{
    "welcome": true,
    "wifi": true,
    "breakfast": true,
    "conference": false,
    "service": true,
    "feedback": true,
    "action_cards": true,
    "recommendations": false,
    "wallet": false,
    "marketing": false,
    "stay_pushes": false,
    "multi_language": false,
    "pre_stay": false,
    "self_checkout": false,
    "nfc_tags": false,
    "custom_email_domain": false,
    "showcase": false,
    "loyalty": false,
    "eve": false,
    "spa": false,
    "restaurant": false,
    "whatsapp": false,
    "microsite": false,
    "best_price": false,
    "referrals": false,
    "multi_property": false,
    "white_label": false,
    "api_access": false
  }'::jsonb;

-- Bestehende Zeilen: Neue Keys mit Defaults ergänzen (existing values bleiben erhalten)
-- defaults || existing → existing keys überschreiben defaults → sicher
UPDATE hotel_settings
SET features = '{
    "welcome": true,
    "wifi": true,
    "breakfast": true,
    "conference": false,
    "service": true,
    "feedback": true,
    "action_cards": true,
    "recommendations": false,
    "wallet": false,
    "marketing": false,
    "stay_pushes": false,
    "multi_language": false,
    "pre_stay": false,
    "self_checkout": false,
    "nfc_tags": false,
    "custom_email_domain": false,
    "showcase": false,
    "loyalty": false,
    "eve": false,
    "spa": false,
    "restaurant": false,
    "whatsapp": false,
    "microsite": false,
    "best_price": false,
    "referrals": false,
    "multi_property": false,
    "white_label": false,
    "api_access": false
  }'::jsonb || COALESCE(features, '{}'::jsonb)
WHERE true;

-- Legacy-Key-Migration: alte _enabled-Keys in neue Short-Keys überführen
-- (Nur wenn neuer Key noch nicht gesetzt wurde, d.h. Standardwert false hat)
UPDATE hotel_settings
SET features = features
  -- breakfast: _enabled → neue key
  || CASE WHEN (features->>'breakfast_enabled')::boolean = true AND (features->>'breakfast')::boolean = false
          THEN '{"breakfast": true}'::jsonb ELSE '{}'::jsonb END
  -- conference
  || CASE WHEN (features->>'conference_enabled')::boolean = true AND (features->>'conference')::boolean = false
          THEN '{"conference": true}'::jsonb ELSE '{}'::jsonb END
  -- eve
  || CASE WHEN (features->>'eve_enabled')::boolean = true AND (features->>'eve')::boolean = false
          THEN '{"eve": true}'::jsonb ELSE '{}'::jsonb END
  -- wallet
  || CASE WHEN (features->>'wallet_enabled')::boolean = true AND (features->>'wallet')::boolean = false
          THEN '{"wallet": true}'::jsonb ELSE '{}'::jsonb END
  -- marketing
  || CASE WHEN (features->>'marketing_enabled')::boolean = true AND (features->>'marketing')::boolean = false
          THEN '{"marketing": true}'::jsonb ELSE '{}'::jsonb END
  -- self_checkout
  || CASE WHEN (features->>'self_checkout_enabled')::boolean = true AND (features->>'self_checkout')::boolean = false
          THEN '{"self_checkout": true}'::jsonb ELSE '{}'::jsonb END
WHERE features IS NOT NULL
  AND (
    (features ? 'breakfast_enabled') OR
    (features ? 'conference_enabled') OR
    (features ? 'eve_enabled') OR
    (features ? 'wallet_enabled') OR
    (features ? 'marketing_enabled') OR
    (features ? 'self_checkout_enabled')
  );
