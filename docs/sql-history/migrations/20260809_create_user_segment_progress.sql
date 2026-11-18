-- Stores per-user completion state for uploaded roadmap segments.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_segment_progress (
  user_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_segment_progress_pkey PRIMARY KEY (user_id, segment_id),
  CONSTRAINT user_segment_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_segment_progress_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments (id) ON DELETE CASCADE,
  CONSTRAINT user_segment_progress_status_check CHECK (
    status IN ('not_started', 'in_progress', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS user_segment_progress_segment_id_idx
  ON public.user_segment_progress (segment_id);

CREATE INDEX IF NOT EXISTS user_segment_progress_user_status_idx
  ON public.user_segment_progress (user_id, status);

ALTER TABLE public.user_segment_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_segment_progress_select_own ON public.user_segment_progress;
DROP POLICY IF EXISTS user_segment_progress_insert_own ON public.user_segment_progress;
DROP POLICY IF EXISTS user_segment_progress_update_own ON public.user_segment_progress;
DROP POLICY IF EXISTS user_segment_progress_delete_own ON public.user_segment_progress;

CREATE POLICY user_segment_progress_select_own
  ON public.user_segment_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_segment_progress_insert_own
  ON public.user_segment_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_segment_progress_update_own
  ON public.user_segment_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_segment_progress_delete_own
  ON public.user_segment_progress
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_segment_progress TO authenticated;

COMMIT;
