-- Migrate valid custom logos to logo_primary before dropping logo_url.
-- Filters out retaha default/placeholder images.
UPDATE hotels
SET logo_primary = logo_url
WHERE logo_primary IS NULL
  AND logo_url IS NOT NULL
  AND logo_url NOT ILIKE '%retaha%'
  AND logo_url NOT ILIKE '%specht%'
  AND logo_url NOT ILIKE '%placeholder%'
  AND logo_url NOT ILIKE '%default%';

-- Drop deprecated column.
-- Code no longer references logo_url — deploy code first, then run this.
ALTER TABLE hotels DROP COLUMN logo_url;
