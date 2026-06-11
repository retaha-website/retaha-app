-- F2-PLUS: Frühstück — Pauschalpreis + Room-Service
-- Adds three columns to hotel_settings for the breakfast module upgrade:
--   breakfast_price_cents          — Pauschalpreis pro Person in Cent (null = kein Preis konfiguriert)
--   breakfast_room_service_enabled — Room-Service-Lieferung auf Zimmer anbieten
--   breakfast_room_service_fee_cents — Aufschlag für Room-Service in Cent

ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS breakfast_price_cents          integer      NULL,
  ADD COLUMN IF NOT EXISTS breakfast_room_service_enabled boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakfast_room_service_fee_cents integer    NOT NULL DEFAULT 0;
