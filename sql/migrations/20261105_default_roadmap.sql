-- A user can mark one roadmap as their default. The Your Roadmaps tab (and app entry
-- for subscribers) opens it immediately; the list is still one Back press away.
ALTER TABLE public.user_roadmaps
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- At most one default roadmap per user.
CREATE UNIQUE INDEX IF NOT EXISTS user_roadmaps_one_default_per_user_idx
  ON public.user_roadmaps (user_id)
  WHERE is_default;
