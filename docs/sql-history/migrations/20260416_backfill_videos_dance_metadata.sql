-- Backfill existing videos with default dance metadata for initial roadmap split.
UPDATE public.videos
SET
  dance_type = 'bachata',
  dance_style = 'fusion';
