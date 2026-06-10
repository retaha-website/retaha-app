-- Sprint D · Phase 6e — Hotel-Logos Storage-Bucket
-- ========================================================================
-- Bucket "hotel-logos" für Hotelier-Selbst-Upload (replaces Placeholder in
-- onboarding/setup/branding.astro). Logos sind eh public (rendered im
-- Gast-Frontend + Backoffice-Header + Email-Notifications), daher
-- public=true. Service-Role-Uploads umgehen RLS sowieso.
--
-- File-Size: 2 MB hart. MIME-Whitelist: PNG/JPEG/SVG/WebP.
-- Pfad-Konvention: <hotel_id>/<timestamp>.<ext>
-- ========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel-logos',
  'hotel-logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public Read-Access Policy (Storage-Standard für public Buckets)
DROP POLICY IF EXISTS "Public read hotel-logos" ON storage.objects;
CREATE POLICY "Public read hotel-logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hotel-logos');

-- Schreibrechte nur via Service-Role (API-Route mit createSupabaseServiceRoleInstance) —
-- keine policy für anon/authenticated nötig, Service-Role bypasst RLS.
