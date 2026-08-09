-- Scope categories to a single roadmap so they are never shared across roadmaps.

BEGIN;

ALTER TABLE public.video_categories
  ADD COLUMN IF NOT EXISTS roadmap_id uuid REFERENCES public.user_roadmaps (id) ON DELETE CASCADE;

-- Drop legacy uniqueness rules first. The migration duplicates category names across
-- roadmaps for the same user, which conflicts with the old user-scoped unique index.
DROP INDEX IF EXISTS public.video_categories_system_name_idx;
DROP INDEX IF EXISTS public.video_categories_user_name_idx;

CREATE TEMP TABLE tmp_category_roadmap_map (
  old_category_id uuid NOT NULL,
  roadmap_id uuid NOT NULL,
  new_category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (old_category_id, roadmap_id)
);

-- Build category/roadmap pairs from existing segments.
INSERT INTO tmp_category_roadmap_map (old_category_id, roadmap_id)
SELECT DISTINCT s.category_id, vu.roadmap_id
FROM public.segments s
JOIN public.video_uploads vu ON vu.id = s.video_upload_id
WHERE vu.roadmap_id IS NOT NULL;

-- Include existing user categories that may not have segments yet.
INSERT INTO tmp_category_roadmap_map (old_category_id, roadmap_id)
SELECT c.id, first_roadmap.id
FROM public.video_categories c
JOIN LATERAL (
  SELECT ur.id
  FROM public.user_roadmaps ur
  WHERE ur.user_id = c.user_id
  ORDER BY ur.created_at
  LIMIT 1
) first_roadmap ON true
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_category_roadmap_map m
    WHERE m.old_category_id = c.id
  );

INSERT INTO public.video_categories (
  id,
  user_id,
  roadmap_id,
  name,
  description,
  system_category,
  created_at,
  updated_at
)
SELECT
  m.new_category_id,
  CASE WHEN c.system_category THEN NULL ELSE c.user_id END,
  m.roadmap_id,
  c.name,
  c.description,
  c.system_category,
  c.created_at,
  c.updated_at
FROM tmp_category_roadmap_map m
JOIN public.video_categories c ON c.id = m.old_category_id;

-- Remap segments to the new roadmap-scoped category ids.
UPDATE public.segments s
SET category_id = m.new_category_id
FROM public.video_uploads vu
JOIN tmp_category_roadmap_map m ON m.roadmap_id = vu.roadmap_id
WHERE s.video_upload_id = vu.id
  AND s.category_id = m.old_category_id;

-- Remove legacy non-scoped category rows.
DELETE FROM public.video_categories
WHERE roadmap_id IS NULL;

-- Ensure every roadmap has its own Misc category.
INSERT INTO public.video_categories (user_id, roadmap_id, name, description, system_category)
SELECT NULL, ur.id, 'Misc', NULL, true
FROM public.user_roadmaps ur
WHERE NOT EXISTS (
  SELECT 1
  FROM public.video_categories vc
  WHERE vc.roadmap_id = ur.id
    AND lower(trim(vc.name)) = 'misc'
);

ALTER TABLE public.video_categories
  ALTER COLUMN roadmap_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS video_categories_roadmap_name_idx
  ON public.video_categories (roadmap_id, lower(name));

-- Category delete should remove dependent segments.
ALTER TABLE public.segments
  DROP CONSTRAINT IF EXISTS segments_category_id_fkey;
ALTER TABLE public.segments
  ADD CONSTRAINT segments_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.video_categories (id) ON DELETE CASCADE;

DROP POLICY IF EXISTS video_categories_select_available ON public.video_categories;
DROP POLICY IF EXISTS video_categories_insert_own ON public.video_categories;
DROP POLICY IF EXISTS video_categories_update_own ON public.video_categories;
DROP POLICY IF EXISTS video_categories_delete_own ON public.video_categories;

CREATE POLICY video_categories_select_available ON public.video_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roadmaps ur
      WHERE ur.id = roadmap_id
        AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY video_categories_insert_own ON public.video_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    system_category = false
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_roadmaps ur
      WHERE ur.id = roadmap_id
        AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY video_categories_update_own ON public.video_categories
  FOR UPDATE TO authenticated
  USING (
    system_category = false
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_roadmaps ur
      WHERE ur.id = roadmap_id
        AND ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    system_category = false
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_roadmaps ur
      WHERE ur.id = roadmap_id
        AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY video_categories_delete_own ON public.video_categories
  FOR DELETE TO authenticated
  USING (
    system_category = false
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_roadmaps ur
      WHERE ur.id = roadmap_id
        AND ur.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS segments_insert_own ON public.segments;
DROP POLICY IF EXISTS segments_update_own ON public.segments;

CREATE POLICY segments_insert_own ON public.segments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.video_uploads
      JOIN public.video_categories ON video_categories.id = category_id
      WHERE video_uploads.id = video_upload_id
        AND video_uploads.user_id = auth.uid()
        AND video_categories.roadmap_id = video_uploads.roadmap_id
    )
  );

CREATE POLICY segments_update_own ON public.segments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.video_uploads
      JOIN public.video_categories ON video_categories.id = category_id
      WHERE video_uploads.id = video_upload_id
        AND video_uploads.user_id = auth.uid()
        AND video_categories.roadmap_id = video_uploads.roadmap_id
    )
  );

COMMIT;
