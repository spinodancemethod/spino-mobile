-- Store notes for user-owned local video references without coupling to legacy videos.

BEGIN;

-- Each segment is a standalone learning item on a user's roadmap.
-- These fields let users customize card-level presentation and notes per segment.
ALTER TABLE public.segments
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_reference text;

ALTER TABLE public.segments
  DROP CONSTRAINT IF EXISTS segments_title_non_empty_check;

ALTER TABLE public.segments
  ADD CONSTRAINT segments_title_non_empty_check
  CHECK (title IS NULL OR length(trim(title)) > 0);

CREATE TABLE IF NOT EXISTS public.video_upload_notes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_upload_id uuid NOT NULL REFERENCES public.video_uploads (id) ON DELETE CASCADE,
  note_text text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT video_upload_notes_pkey PRIMARY KEY (user_id, video_upload_id)
);

ALTER TABLE public.video_upload_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_upload_notes' AND policyname = 'video_upload_notes_select_own') THEN
    CREATE POLICY video_upload_notes_select_own ON public.video_upload_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_upload_notes' AND policyname = 'video_upload_notes_insert_own') THEN
    CREATE POLICY video_upload_notes_insert_own ON public.video_upload_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_upload_notes' AND policyname = 'video_upload_notes_update_own') THEN
    CREATE POLICY video_upload_notes_update_own ON public.video_upload_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_upload_notes' AND policyname = 'video_upload_notes_delete_own') THEN
    CREATE POLICY video_upload_notes_delete_own ON public.video_upload_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_upload_notes TO authenticated;

COMMIT;
