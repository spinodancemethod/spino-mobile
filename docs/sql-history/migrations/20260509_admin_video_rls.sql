-- Admin RLS policies: allow spino@spino.com to insert/update videos,
-- and allow authenticated users to read from the videos storage bucket.

BEGIN;

-- Videos table: admin insert/update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_insert_admin'
  ) THEN
    CREATE POLICY videos_insert_admin ON public.videos
      FOR INSERT TO authenticated
      WITH CHECK ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_update_admin'
  ) THEN
    CREATE POLICY videos_update_admin ON public.videos
      FOR UPDATE TO authenticated
      USING ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;
END $$;

-- Storage bucket policies
DO $$
BEGIN
  -- All authenticated users can read from the videos bucket (enables signed URL generation)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'videos_bucket_select_authenticated'
  ) THEN
    CREATE POLICY videos_bucket_select_authenticated
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'videos');
  END IF;

  -- Admin can upload to videos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'videos_bucket_insert_admin'
  ) THEN
    CREATE POLICY videos_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'videos' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  -- Admin can upload to thumbnails bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'thumbnails_bucket_insert_admin'
  ) THEN
    CREATE POLICY thumbnails_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'thumbnails' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  -- Admin can upload to roadmap-previews bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'roadmap_previews_bucket_insert_admin'
  ) THEN
    CREATE POLICY roadmap_previews_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'roadmap-previews' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;
END $$;

COMMIT;
