-- Add optional descriptions to user/system video categories.

BEGIN;

ALTER TABLE public.video_categories
  ADD COLUMN IF NOT EXISTS description text;

COMMIT;
