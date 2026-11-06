-- Fable v2 Prompt 10: position library as categories.
-- A `position_templates` table holds the per-dance-style vocabulary (seeded from
-- worker/positions/positions.json). `apply_position_library(roadmap, style)` copies the
-- active templates into the caller's categories for that roadmap as ordinary user-owned
-- categories tagged with `position_slug`, so users can rename/delete them and add their own.
-- (System categories have a global unique name index, so they cannot be per-roadmap.)

BEGIN;

CREATE TABLE IF NOT EXISTS public.position_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dance_style text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT position_templates_style_slug_unique UNIQUE (dance_style, slug),
  CONSTRAINT position_templates_name_check CHECK (length(trim(name)) > 0)
);
ALTER TABLE public.position_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'position_templates' AND policyname = 'position_templates_select_all') THEN
    CREATE POLICY position_templates_select_all ON public.position_templates FOR SELECT TO authenticated USING (active);
  END IF;
END $$;
GRANT SELECT ON public.position_templates TO authenticated;

ALTER TABLE public.video_categories
  ADD COLUMN IF NOT EXISTS position_slug text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- Seed (idempotent; names/descriptions refresh, slugs are stable)
INSERT INTO public.position_templates (dance_style, slug, name, description, sort_order, active) VALUES
  ('bachata', 'basic_sensual', 'Close Sensual Position', 'Partners face each other in a close embrace, typically with hip connection. Torsos touching or nearly touching.', 10, true),
  ('bachata', 'basic', 'Open Position (Basic Position)', 'Partners face each other with space between them, connected by one or both hands. Standard hold: leader''s left hand holds the follower''s right hand.', 20, true),
  ('bachata', 'cross_hand', 'Cross-Hand Position', 'Partners face each other holding BOTH hands with the arms crossed (leader''s left to follower''s left and right to right), one arm passing over the other.', 30, true),
  ('bachata', 'handshake', 'Handshake Hold', 'Partners face each other with a single handshake-style hand connection (same-side hands joined). Other hands free.', 40, true),
  ('bachata', 'shadow', 'Shadow Position – Follower in Front', 'Follower stands ahead, leader stands directly behind, both facing the same direction. Hands held in an open frame or light frame contact, not wrapped across the body.', 50, true),
  ('bachata', 'reverse_shadow', 'Reverse Shadow Position – Leader in Front', 'Leader stands ahead, follower stands directly behind, both facing the same direction.', 60, true),
  ('bachata', 'cuddle', 'Cuddle Position / Wrap Position – Follower in Front', 'Follower is in front and wrapped by the leader, with one or both arms positioned across the follower''s body.', 70, true),
  ('bachata', 'side_by_side', 'Side-by-Side', 'Partners stand alongside each other, shoulder to shoulder, both facing the same direction, connected by one or both hands. Not wrapped.', 80, true),
  ('bachata', 'shadow_back_to_back', 'Back-to-Back Position', 'Partners stand with their backs towards each other, facing opposite directions, often keeping a hand connection.', 90, true),
  ('bachata', 'hammerlock', 'Hammerlock', 'One dancer''s arm is folded behind their own back and held there by the partner''s hand.', 100, true)
ON CONFLICT (dance_style, slug) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order,
      active = EXCLUDED.active, updated_at = timezone('utc'::text, now());

-- Copy the library into the caller's categories for one roadmap. Re-running adds
-- any new templates and leaves existing (possibly renamed) ones alone.
CREATE OR REPLACE FUNCTION public.apply_position_library(p_roadmap_id uuid, p_dance_style text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roadmaps WHERE id = p_roadmap_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'roadmap not found';
  END IF;
  WITH ins AS (
    INSERT INTO public.video_categories (user_id, roadmap_id, name, description, system_category, position_slug, sort_order)
    SELECT auth.uid(), p_roadmap_id, t.name, t.description, false, t.slug, t.sort_order
    FROM public.position_templates t
    WHERE t.dance_style = p_dance_style AND t.active
      AND NOT EXISTS (
        SELECT 1 FROM public.video_categories c
        WHERE c.roadmap_id = p_roadmap_id AND c.user_id = auth.uid()
          AND (c.position_slug = t.slug OR lower(c.name) = lower(t.name))
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_position_library(uuid, text) TO authenticated;

COMMIT;
