-- Sprint E4 · Phase 1 — Eve-Persönlichkeit (RENAME concierge_* → eve_* + neue Settings)
-- Erstellt: 2026-06-01
--
-- Phase-0-Diskovery: hotel_settings hat bereits concierge_name='Maria' + concierge_online_until.
-- Wir benennen die alten Felder um statt parallel anzulegen (DEV-only, kein Live-Code-Risiko).
-- Neue Eve-spezifische Felder (eve_enabled, eve_tonality, eve_custom_persona, eve_tuning_rules)
-- kommen daneben dazu.
--
-- features.concierge_chat (JSONB-Toggle) bleibt erhalten als Hotelier-UI-Toggle für den Tile —
-- eve_enabled ist der zusätzliche Master-Switch (Hotel-Owner kann Eve komplett aus haben).

ALTER TABLE hotel_settings
  RENAME COLUMN concierge_name TO eve_name;

ALTER TABLE hotel_settings
  RENAME COLUMN concierge_online_until TO eve_online_until;

-- Default-Wert von 'Maria' auf 'Eve' umstellen — bestehende Rows bleiben unverändert
ALTER TABLE hotel_settings
  ALTER COLUMN eve_name SET DEFAULT 'Eve';

-- Neue Eve-Felder
ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS eve_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eve_tonality TEXT NOT NULL DEFAULT 'warm_formal'
    CHECK (eve_tonality IN ('warm_formal', 'casual', 'custom')),
  ADD COLUMN IF NOT EXISTS eve_custom_persona TEXT,
  ADD COLUMN IF NOT EXISTS eve_tuning_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN hotel_settings.eve_name IS
  'Name der KI-Concierge (default Eve, umbenennbar). Ersetzt früheres concierge_name.';
COMMENT ON COLUMN hotel_settings.eve_online_until IS
  'Anzeige-Hint im Gast-Frontend ("online bis 22:00"). Eve ist technisch 24/7 verfügbar — das ist nur ein vom Hotelier gepflegter Service-Versprechens-Hinweis. Ersetzt früheres concierge_online_until.';
COMMENT ON COLUMN hotel_settings.eve_enabled IS
  'Master-Switch für Eve. Default false — Hotelier muss bewusst aktivieren (Premium-Modul). Zusätzlich zum features.concierge_chat-Toggle der den Tile zeigt/versteckt.';
COMMENT ON COLUMN hotel_settings.eve_tonality IS
  'warm_formal=Premium-Concierge, casual=Buddy-Tone, custom=eve_custom_persona-Text wird genutzt.';
COMMENT ON COLUMN hotel_settings.eve_custom_persona IS
  'Frei-Text-Persona-Beschreibung — nur aktiv wenn eve_tonality=custom.';
COMMENT ON COLUMN hotel_settings.eve_tuning_rules IS
  'JSONB-Array von {trigger, instruction, force_model?}-Pairs für Soft-Rules ("Wenn Gast nach Restaurant fragt, empfiehl zuerst unser hauseigenes").';
