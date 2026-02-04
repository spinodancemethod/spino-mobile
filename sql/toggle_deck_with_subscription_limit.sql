-- toggle_deck_with_subscription_limit.sql
-- RPC to toggle a deck entry for a user with per-tier limits.
-- Usage: supabase.rpc('toggle_deck_with_subscription_limit', { p_user := uuid, p_video := uuid })

CREATE OR REPLACE FUNCTION public.toggle_deck_with_subscription_limit(
  p_user uuid,
  p_video uuid
)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  exists_row boolean;
  current_count int;
  lock_key bigint;
  tier text;
  allowed int := 3; -- default for free users
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  -- Try to read an explicit per-user limit or tier from a profiles table.
  -- Adjust this SELECT to match your schema if different.
  BEGIN
    SELECT deck_limit, sub_tier INTO allowed, tier FROM public.profiles WHERE id = p_user;
  EXCEPTION WHEN others THEN
    -- ignore if profiles table doesn't exist or column missing
    allowed := NULL;
    tier := NULL;
  END;

  IF allowed IS NULL THEN
    IF tier = 'premium' THEN
      allowed := 10;
    ELSE
      allowed := 3;
    END IF;
  END IF;

  -- per-user advisory lock to serialize concurrent toggles
  SELECT ('x' || substr(md5(p_user::text),1,15))::bit(60)::bigint INTO lock_key;
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT EXISTS(SELECT 1 FROM public.deck d WHERE d.user_id = p_user AND d.video_id = p_video) INTO exists_row;

  IF exists_row THEN
    DELETE FROM public.deck WHERE user_id = p_user AND video_id = p_video;
    RETURN 'deleted';
  ELSE
    SELECT COUNT(*) FROM public.deck WHERE user_id = p_user INTO current_count;
    IF current_count >= allowed THEN
      RAISE EXCEPTION 'deck limit reached';
    END IF;
    INSERT INTO public.deck (user_id, video_id) VALUES (p_user, p_video);
    RETURN 'inserted';
  END IF;
END;
$$;
