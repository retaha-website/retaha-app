-- Phase 8.E: Setup-Wizard Branding-Step
-- Hotel-Akzentfarbe als VARCHAR(7) Hex-String, Default = retaha-Burgund.

ALTER TABLE hotel_settings
  ADD COLUMN accent_color VARCHAR(7) NOT NULL DEFAULT '#8C2128';
