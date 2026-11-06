-- Add user-owned roadmaps and require every local video reference to belong to one.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_roadmaps_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT user_roadmaps_user_name_unique UNIQUE (user_id, name)
);

ALTER TABLE public.video_uploads ADD COLUMN IF NOT EXISTS roadmap_id uuid;

INSERT INTO public.user_roadmaps (user_id, name, description)
SELECT DISTINCT vu.user_id, 'My First RoadMap', 'Default roadmap'
FROM public.video_uploads vu
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roadmaps ur
  WHERE ur.user_id = vu.user_id AND ur.name = 'My First RoadMap'
);

UPDATE public.video_uploads vu
SET roadmap_id = ur.id
FROM public.user_roadmaps ur
WHERE ur.user_id = vu.user_id
  AND ur.name = 'My First RoadMap'
  AND vu.roadmap_id IS NULL;

ALTER TABLE public.video_uploads
  DROP CONSTRAINT IF EXISTS video_uploads_roadmap_id_fkey;
ALTER TABLE public.video_uploads
  ADD CONSTRAINT video_uploads_roadmap_id_fkey
  FOREIGN KEY (roadmap_id) REFERENCES public.user_roadmaps (id) ON DELETE CASCADE;
ALTER TABLE public.video_uploads ALTER COLUMN roadmap_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS user_roadmaps_user_updated_idx
  ON public.user_roadmaps (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS video_uploads_roadmap_idx
  ON public.video_uploads (user_id, roadmap_id, updated_at DESC);

ALTER TABLE public.user_roadmaps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_select_own') THEN
    CREATE POLICY user_roadmaps_select_own ON public.user_roadmaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_insert_own') THEN
    CREATE POLICY user_roadmaps_insert_own ON public.user_roadmaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_update_own') THEN
    CREATE POLICY user_roadmaps_update_own ON public.user_roadmaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_delete_own') THEN
    CREATE POLICY user_roadmaps_delete_own ON public.user_roadmaps FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roadmaps TO authenticated;

COMMIT;
