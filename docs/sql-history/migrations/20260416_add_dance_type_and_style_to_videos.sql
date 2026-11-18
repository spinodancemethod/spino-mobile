-- Add dance metadata for upcoming roadmap segmentation (salsa vs bachata).
ALTER TABLE public.videos
  ADD COLUMN dance_type text,
  ADD COLUMN dance_style text;

-- Keep allowed values narrow while still permitting NULL for existing/backfill rows.
ALTER TABLE public.videos
  ADD CONSTRAINT videos_dance_type_check
  CHECK (dance_type IS NULL OR dance_type IN ('salsa', 'bachata'));
