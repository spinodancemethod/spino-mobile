-- 02_functions.sql
-- Shared database helpers and RPC entrypoints used by the app.

BEGIN;

-- Central entitlement helper used by app checks and RLS policies.
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('trialing', 'active', 'grace_period')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

COMMIT;
