-- Sprint D · Phase 6b — Reconnect-Symmetrie
-- ========================================================================
-- Disconnect soll Service-Mappings + Tax-Code + Pricing-Defaults erhalten,
-- damit der Hotelier nach Reconnect nicht alles neu konfigurieren muss
-- (UX-Friction aus Sprint-C-Verifikation).
--
-- Dafür brauchen wir nullable enterprise_id + access_token_encrypted —
-- die Row bleibt als "Mappings-Träger" stehen, Auth-Daten sind weg.
-- ========================================================================

ALTER TABLE mews_integrations
  ALTER COLUMN enterprise_id DROP NOT NULL,
  ALTER COLUMN access_token_encrypted DROP NOT NULL;

COMMENT ON COLUMN mews_integrations.access_token_encrypted IS
  'AES-256-GCM verschlüsselter Mews-Access-Token. NULL = Hotel ist nicht verbunden (Disconnect behält Mappings, Reconnect setzt Token neu).';

COMMENT ON COLUMN mews_integrations.enterprise_id IS
  'Mews-Enterprise-Id. NULL bei disconnected Hotels (Mappings bleiben aber stehen).';
