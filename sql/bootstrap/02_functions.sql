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

-- Atomic deck toggle RPC with a per-user advisory lock to avoid concurrent race issues.
CREATE OR REPLACE FUNCTION public.toggle_deck_with_subscription_limit(
  p_user uuid,
  p_video uuid
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  exists_row boolean;
  current_count int;
  lock_key bigint;
  allowed int := 3;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  IF public.has_active_subscription(p_user) THEN
    allowed := 10;
  END IF;

  SELECT ('x' || substr(md5(p_user::text), 1, 15))::bit(60)::bigint INTO lock_key;
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT EXISTS(
    SELECT 1
    FROM public.deck d
    WHERE d.user_id = p_user
      AND d.video_id = p_video
  ) INTO exists_row;

  IF exists_row THEN
    DELETE FROM public.deck
    WHERE user_id = p_user
      AND video_id = p_video;
    RETURN 'deleted';
  END IF;

  SELECT COUNT(*)
  INTO current_count
  FROM public.deck
  WHERE user_id = p_user;

  IF current_count >= allowed THEN
    RAISE EXCEPTION 'deck limit reached';
  END IF;

  INSERT INTO public.deck (user_id, video_id)
  VALUES (p_user, p_video);

  RETURN 'inserted';
END;
$$;

COMMIT;
