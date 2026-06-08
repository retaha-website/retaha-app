-- Migrate classic → bauhaus
-- Hotels that still have design_identity = 'classic' or NULL get bauhaus as default.
-- The constraint already accepts 'bauhaus' from 20260623_design_identities_3themes.sql.

UPDATE hotels
  SET design_identity = 'bauhaus'
WHERE design_identity = 'classic'
   OR design_identity IS NULL;
