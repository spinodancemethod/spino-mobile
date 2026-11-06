-- Category tile images: an optional picture per video category, stored in a
-- public storage bucket under <user_id>/<category_id>-<ts>.<ext>. The row keeps
-- the object path (not a URL) so the bucket can move without a data migration.

BEGIN;

ALTER TABLE public.video_categories
  ADD COLUMN IF NOT EXISTS image_path text;

-- Public bucket: tiles render the public URL directly (no signing round trip).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('category-images', 'category-images', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Users manage objects only inside their own folder.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'category_images_select_authenticated') THEN
    CREATE POLICY category_images_select_authenticated ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'category-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'category_images_insert_own_folder') THEN
    CREATE POLICY category_images_insert_own_folder ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'category-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'category_images_update_own_folder') THEN
    CREATE POLICY category_images_update_own_folder ON storage.objects
      FOR UPDATE TO authenticated USING (
        bucket_id = 'category-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'category_images_delete_own_folder') THEN
    CREATE POLICY category_images_delete_own_folder ON storage.objects
      FOR DELETE TO authenticated USING (
        bucket_id = 'category-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

COMMIT;
