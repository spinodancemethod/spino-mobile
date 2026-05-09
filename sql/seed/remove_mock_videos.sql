-- Remove all mock/seed video rows.
--
-- FK constraints on deck, favourites, notes, and user_video_progress
-- all use ON DELETE CASCADE, so those rows are cleaned up automatically.
--
-- If you only want to remove a subset, replace the bare DELETE with a WHERE clause:
--   DELETE FROM public.videos WHERE title ILIKE '%test%' OR title ILIKE '%mock%';

BEGIN;

DELETE FROM public.videos;

COMMIT;
