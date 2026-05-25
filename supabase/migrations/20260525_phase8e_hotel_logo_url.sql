-- Phase 8.E.x — Hotel-Logo-URL für Navbar-Branding
-- Datum: 25.05.2026
--
-- Fügt eine logo_url-Spalte zur hotels-Tabelle hinzu damit die Admin-Navbar
-- ein Hotel-Logo anzeigen kann. Aktuell wird der Pfad zu einer statischen
-- Datei in /public/hotel-assets/ verwendet. Später (Phase 8.E.2) wird das
-- via Supabase Storage Upload ersetzbar.

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

-- Demo-Hotel "The Gate Garden" mit bestehendem Logo-SVG verknüpfen
UPDATE hotels
   SET logo_url = '/hotel-assets/logo-thegate.svg'
 WHERE id = '1f30ac02-17e1-47b6-9bda-487e14b07627';

-- Kommentar für Doku
COMMENT ON COLUMN hotels.logo_url IS 'Pfad oder URL zum Hotel-Logo. Aktuell statischer Pfad in /public/hotel-assets/, später Supabase Storage URL. NULL = kein Logo, Fallback auf Hotel-Name als Editorial-Text.';
