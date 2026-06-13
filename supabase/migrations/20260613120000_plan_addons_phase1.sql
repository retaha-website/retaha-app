-- Phase 1: Plan/Add-ons System + Conference-Cleanup
-- Taha-Freigabe 2026-06-13 (CC-SPRINT Paket-Modell Phase 0 Approval)

-- ══════════════════════════════════════════════════════
-- 1. hotels: plan + addons Spalten
-- ══════════════════════════════════════════════════════
ALTER TABLE public.hotels
  ADD COLUMN plan    text NOT NULL DEFAULT 'lite'
    CONSTRAINT hotels_plan_check CHECK (plan IN ('lite','pro','premium','enterprise')),
  ADD COLUMN addons  text[] NOT NULL DEFAULT '{}';

-- ══════════════════════════════════════════════════════
-- 2. Backfill: Tahas Hotel → premium (alle Module verfügbar für Tests)
--    Alle anderen Hotels bleiben auf 'lite'.
-- ══════════════════════════════════════════════════════
UPDATE public.hotels
SET plan = 'premium'
WHERE id = 'c827efae-7343-4979-90e7-3d44fbcc266a';

-- ══════════════════════════════════════════════════════
-- 3. hotel_settings: Conference-Spalten droppen (totes Modul, keine Daten)
--    Bestätigt: conference_rooms = [], keine Buchungen, keine Räume in Prod.
-- ══════════════════════════════════════════════════════
ALTER TABLE public.hotel_settings
  DROP COLUMN IF EXISTS conference_rooms,
  DROP COLUMN IF EXISTS conference_start_time,
  DROP COLUMN IF EXISTS conference_end_time,
  DROP COLUMN IF EXISTS conference_slot_minutes;

-- ══════════════════════════════════════════════════════
-- 4. features JSONB: Altlasten entfernen
--    - _enabled Doubletten (niemand liest sie)
--    - conference (totes Modul)
--    - self_checkout (halbfertig, vorerst ausgeschlossen)
--    - empfehlungen (Altlast-Doublette von recommendations)
-- ══════════════════════════════════════════════════════
UPDATE public.hotel_settings
SET features = features
  - 'empfehlungen'
  - 'conference'
  - 'self_checkout'
  - 'eve_enabled'
  - 'conference_enabled'
  - 'self_checkout_enabled'
  - 'service_enabled'
  - 'breakfast_enabled'
  - 'marketing_enabled'
  - 'pre_stay_enabled'
  - 'wallet_enabled';

-- ══════════════════════════════════════════════════════
-- 5. hotel_settings: features DEFAULT aktualisieren
--    Tote Schlüssel entfernt, neue Struktur für künftige INSERT-Rows.
-- ══════════════════════════════════════════════════════
ALTER TABLE public.hotel_settings
  ALTER COLUMN features SET DEFAULT
    '{"eve":false,"spa":false,"wifi":true,"wallet":false,"loyalty":false,"service":true,"welcome":true,"feedback":true,"nfc_tags":false,"pre_stay":false,"showcase":false,"whatsapp":false,"breakfast":true,"marketing":false,"microsite":false,"referrals":false,"api_access":false,"best_price":false,"restaurant":false,"stay_pushes":false,"white_label":false,"action_cards":true,"multi_language":false,"multi_property":false,"recommendations":false,"custom_email_domain":false}'::jsonb;

-- ══════════════════════════════════════════════════════
-- NOTE: mews_integrations.conference_charge_enabled + service_id_conference
-- NICHT hier gedroppt — Mews-Logik prüfen:
--   conference_charge_enabled (bool DEFAULT true): steuert ob Konferenz-Buchungen
--     via Mews verrechnet werden (referenziert in mews/orders.ts Charge-Logik).
--   service_id_conference (text): Mews Product-Service-ID für Konferenz-Charges.
-- Aktion: mit Taha klären (Mews deaktiviert? Integrations aktiv?) → separater PR.
-- ══════════════════════════════════════════════════════
