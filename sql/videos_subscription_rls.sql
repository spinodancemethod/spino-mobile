-- videos_subscription_rls.sql
-- Restrict video reads to authenticated users with an active subscription.
-- Run this after billing migrations that create has_active_subscription(uuid).

BEGIN;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Remove existing SELECT policies so one clear entitlement policy controls access.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'videos'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.videos', p.policyname);
  END LOOP;
END $$;

CREATE POLICY videos_select_active_subscription ON public.videos
  FOR SELECT
  TO authenticated
  USING (public.has_active_subscription(auth.uid()));

GRANT SELECT ON public.videos TO authenticated;

COMMIT;
