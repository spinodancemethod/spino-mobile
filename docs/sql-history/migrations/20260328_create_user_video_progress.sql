-- Create a per-user, per-video progress table for roadmap completion state.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_video_progress (
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_video_progress_pkey PRIMARY KEY (user_id, video_id),
  CONSTRAINT user_video_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_video_progress_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos (id) ON DELETE CASCADE,
  CONSTRAINT user_video_progress_status_check CHECK (
    status IN ('not_started', 'in_progress', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS user_video_progress_video_id_idx
  ON public.user_video_progress (video_id);

CREATE INDEX IF NOT EXISTS user_video_progress_user_status_idx
  ON public.user_video_progress (user_id, status);

ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_select_own'
  ) THEN
    CREATE POLICY user_video_progress_select_own
      ON public.user_video_progress
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_insert_own'
  ) THEN
    CREATE POLICY user_video_progress_insert_own
      ON public.user_video_progress
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_update_own'
  ) THEN
    CREATE POLICY user_video_progress_update_own
      ON public.user_video_progress
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_delete_own'
  ) THEN
    CREATE POLICY user_video_progress_delete_own
      ON public.user_video_progress
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.user_video_progress TO authenticated;
GRANT INSERT ON public.user_video_progress TO authenticated;
GRANT UPDATE ON public.user_video_progress TO authenticated;
GRANT DELETE ON public.user_video_progress TO authenticated;

COMMIT;