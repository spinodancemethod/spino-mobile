-- Add has_videos flag to positions.
-- Default all positions to true, then explicitly mark selected entries false.

BEGIN;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS has_videos boolean NOT NULL DEFAULT true;

UPDATE public.positions
SET has_videos = false
WHERE lower(trim(name)) IN ('basic on 1', 'basic on 5');

COMMIT;
