-- Introduce tier-aware access control for positions so they can be selectively
-- free or premium in the same way as videos.
--
-- Changes:
--   1. Add access_tier to public.positions (default 'paid').
--   2. Create can_access_position helper.
--   3. Update can_access_video so video access also respects position access.
--   4. Replace legacy open positions SELECT policies with tier-aware RLS.
--   5. Grant EXECUTE on the new helper.

BEGIN;

-- 1. Allow each position to be explicitly marked free or paid.
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'paid';

ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_access_tier_check;

ALTER TABLE public.positions
  ADD CONSTRAINT positions_access_tier_check
    CHECK (access_tier IN ('free', 'paid'));

-- 2. Position access helper.
CREATE OR REPLACE FUNCTION public.can_access_position(p_user_id uuid, p_position_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.positions p
      WHERE p.id = p_position_id AND p.access_tier = 'free'
    )
    OR
    public.has_active_subscription(p_user_id);
$$;

-- 3. Make video access depend on both the position tier and the video tier.
CREATE OR REPLACE FUNCTION public.can_access_video(p_user_id uuid, p_video_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = p_video_id
        AND public.can_access_position(p_user_id, v.position_id)
        AND (
          v.access_tier = 'free'
          OR public.has_active_subscription(p_user_id)
        )
    );
$$;

-- 4. Replace open positions policies with tier-aware access.
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.positions;
DROP POLICY IF EXISTS "public can read positions" ON public.positions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'positions'
      AND policyname = 'positions_select_tier_access'
  ) THEN
    CREATE POLICY positions_select_tier_access
      ON public.positions
      FOR SELECT
      TO authenticated
      USING (public.can_access_position(auth.uid(), id));
  END IF;
END $$;

-- 5. Grant function access.
GRANT EXECUTE ON FUNCTION public.can_access_position(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_position(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO service_role;

COMMIT;
