-- Store local video references and metadata without uploading source video files.

BEGIN;

CREATE TABLE IF NOT EXISTS public.video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  local_reference_key text NOT NULL,
  platform text NOT NULL,
  media_identifier text,
  fallback_uri text,
  name text,
  filename text,
  duration_seconds double precision,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  creation_time timestamptz,
  thumbnail_reference text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  replacement_review_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT video_uploads_status_check CHECK (
    status IN ('AVAILABLE', 'MISSING', 'ACCESS_DENIED', 'UNKNOWN')
  ),
  CONSTRAINT video_uploads_local_reference_key_check CHECK (length(trim(local_reference_key)) > 0),
  CONSTRAINT video_uploads_user_local_reference_key_unique UNIQUE (user_id, local_reference_key)
);

CREATE INDEX IF NOT EXISTS video_uploads_user_updated_idx
  ON public.video_uploads (user_id, updated_at DESC);

ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_select_own'
  ) THEN
    CREATE POLICY video_uploads_select_own
      ON public.video_uploads
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_insert_own'
  ) THEN
    CREATE POLICY video_uploads_insert_own
      ON public.video_uploads
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_update_own'
  ) THEN
    CREATE POLICY video_uploads_update_own
      ON public.video_uploads
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_delete_own'
  ) THEN
    CREATE POLICY video_uploads_delete_own
      ON public.video_uploads
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.video_uploads TO authenticated;
GRANT INSERT ON public.video_uploads TO authenticated;
GRANT UPDATE ON public.video_uploads TO authenticated;
GRANT DELETE ON public.video_uploads TO authenticated;

COMMIT;
