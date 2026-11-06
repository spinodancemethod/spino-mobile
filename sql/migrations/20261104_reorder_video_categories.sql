-- Roadmap drag-reorder. Runs as definer so the per-roadmap system category
-- (Misc, user_id NULL) can be ordered too; the roadmap must belong to the caller.
CREATE OR REPLACE FUNCTION public.reorder_video_categories(p_roadmap_id uuid, p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_count integer := 0;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roadmaps WHERE id = p_roadmap_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'roadmap not found';
  END IF;
  WITH ord AS (
    SELECT id, (ordinality - 1) * 10 AS sort_order FROM unnest(p_ids) WITH ORDINALITY AS t(id, ordinality)
  ), upd AS (
    UPDATE public.video_categories c
    SET sort_order = ord.sort_order, updated_at = timezone('utc'::text, now())
    FROM ord
    WHERE c.id = ord.id AND c.roadmap_id = p_roadmap_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reorder_video_categories(uuid, uuid[]) TO authenticated;
