-- Sprint E7 Phase 2 — Storage Bucket für Action-Card-Bilder
--
-- Project liegt in eu-west-2 (London, DSGVO-konform via UK Adequacy
-- Decision). Briefing wünschte eu-central-1; Region ist Project-weit
-- nicht pro Bucket änderbar. Backlog-Item für Project-Move falls strikt
-- Frankfurt nötig.
--
-- Pfad-Konvention: {hotelId}/{cardId}.{ext}
-- Bucket-Limits: 2 MB, MIME jpeg/png/webp.
-- Public-Read: Card-Bilder müssen im Gast-Frontend ohne Auth ladbar sein.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'action-card-images',
  'action-card-images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read-Policy (public-Read via bucket.public=true reicht; explizite Policy
-- nur als Klarstellung / Audit-Trail)
DROP POLICY IF EXISTS "Public read action_card_images" ON storage.objects;
CREATE POLICY "Public read action_card_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'action-card-images');

-- Upload-Policy: nur Hotel-Members für ihren Hotel-Pfad. Service-Role
-- bypasst RLS sowieso (Upload läuft serverseitig mit Service-Role nach
-- App-Side getUserHotels-Check), das hier ist defense-in-depth falls
-- jemand mit User-Token direkt auf Storage zugreift.
DROP POLICY IF EXISTS "Hotel members write action_card_images" ON storage.objects;
CREATE POLICY "Hotel members write action_card_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'action-card-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_hotel_ids())
  );

DROP POLICY IF EXISTS "Hotel members update action_card_images" ON storage.objects;
CREATE POLICY "Hotel members update action_card_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'action-card-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_hotel_ids())
  );

DROP POLICY IF EXISTS "Hotel members delete action_card_images" ON storage.objects;
CREATE POLICY "Hotel members delete action_card_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'action-card-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_hotel_ids())
  );
