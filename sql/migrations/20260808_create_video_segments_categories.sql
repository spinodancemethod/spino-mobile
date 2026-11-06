-- Add user-owned timestamp segments and system/custom categories.

BEGIN;

CREATE TABLE IF NOT EXISTS public.video_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  system_category boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT video_categories_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT video_categories_system_owner_check CHECK (
    (system_category AND user_id IS NULL) OR (NOT system_category AND user_id IS NOT NULL)
  ),
  CONSTRAINT video_categories_misc_reserved_check CHECK (system_category OR lower(trim(name)) <> 'misc')
);

CREATE UNIQUE INDEX IF NOT EXISTS video_categories_system_name_idx
  ON public.video_categories (lower(name))
  WHERE system_category = true;

CREATE UNIQUE INDEX IF NOT EXISTS video_categories_user_name_idx
  ON public.video_categories (user_id, lower(name))
  WHERE system_category = false;

INSERT INTO public.video_categories (user_id, name, system_category)
VALUES (NULL, 'Misc', true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_upload_id uuid NOT NULL REFERENCES public.video_uploads (id) ON DELETE CASCADE,
  sequence integer,
  start_time double precision NOT NULL,
  end_time double precision NOT NULL,
  count_start integer,
  count_end integer,
  category_id uuid NOT NULL REFERENCES public.video_categories (id) ON DELETE RESTRICT,
  user_notes text,
  ai_confidence double precision,
  ai_generated boolean NOT NULL DEFAULT false,
  user_confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT segments_time_order_check CHECK (start_time >= 0 AND start_time < end_time),
  CONSTRAINT segments_confidence_check CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

CREATE INDEX IF NOT EXISTS segments_user_video_idx
  ON public.segments (user_id, video_upload_id, sequence, created_at);

CREATE INDEX IF NOT EXISTS segments_category_idx
  ON public.segments (user_id, category_id);

ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_select_available') THEN
    CREATE POLICY video_categories_select_available ON public.video_categories
      FOR SELECT TO authenticated
      USING (system_category = true OR auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_insert_own') THEN
    CREATE POLICY video_categories_insert_own ON public.video_categories
      FOR INSERT TO authenticated
      WITH CHECK (system_category = false AND auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_update_own') THEN
    CREATE POLICY video_categories_update_own ON public.video_categories
      FOR UPDATE TO authenticated
      USING (system_category = false AND auth.uid() = user_id)
      WITH CHECK (system_category = false AND auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_delete_own') THEN
    CREATE POLICY video_categories_delete_own ON public.video_categories
      FOR DELETE TO authenticated
      USING (system_category = false AND auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments_select_own') THEN
    CREATE POLICY segments_select_own ON public.segments
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments_insert_own') THEN
    CREATE POLICY segments_insert_own ON public.segments
      FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.video_uploads
          WHERE video_uploads.id = video_upload_id AND video_uploads.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments_update_own') THEN
    CREATE POLICY segments_update_own ON public.segments
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.video_uploads
          WHERE video_uploads.id = video_upload_id AND video_uploads.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments_delete_own') THEN
    CREATE POLICY segments_delete_own ON public.segments
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;

COMMIT;
