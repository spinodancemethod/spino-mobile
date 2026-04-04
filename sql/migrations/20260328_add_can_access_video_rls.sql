-- Introduce tier-aware video access control.
--
-- Previously all video SELECTs required an active subscription.
-- This migration adds can_access_video() so that videos marked
-- access_tier = 'free' are also readable by authenticated users
-- without a subscription.
--
-- Steps:
--   1. Create (or replace) the can_access_video helper function.
--   2. Drop the old binary-subscription RLS policy.
--   3. Create the new tier-aware RLS policy.
--   4. Grant EXECUTE on the new function.

BEGIN;

-- 1. Tier-aware access helper.
--    Returns true when the user has an active subscription OR the video is free-tier.
CREATE OR REPLACE FUNCTION public.can_access_video(p_user_id uuid, p_video_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Free-tier videos are always accessible to authenticated users.
    EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = p_video_id AND v.access_tier = 'free'
    )
    OR
    -- Paid videos require an active subscription.
    public.has_active_subscription(p_user_id);
$$;

-- 2. Remove the old subscription-only SELECT policy.
DROP POLICY IF EXISTS videos_select_active_subscription ON public.videos;

-- 3. Create the replacement policy using the new function.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'videos'
      AND policyname = 'videos_select_tier_access'
  ) THEN
    CREATE POLICY videos_select_tier_access
      ON public.videos
      FOR SELECT
      TO authenticated
      USING (public.can_access_video(auth.uid(), id));
  END IF;
END $$;

-- 4. Grant EXECUTE so authenticated clients can call the function directly if needed.
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO service_role;

COMMIT;
