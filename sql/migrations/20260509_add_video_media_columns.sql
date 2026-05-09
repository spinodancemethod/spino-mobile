-- Add media URL columns referenced by VideoRecord but not yet present in the schema.
-- thumbnail_url     — static image shown before playback and in the library grid.
-- roadmap_preview_url — short clip/GIF used on the roadmap canvas node preview.
-- roadmap_gif_url   — optional separate GIF asset for the roadmap (falls back to roadmap_preview_url).

BEGIN;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS thumbnail_url       text,
  ADD COLUMN IF NOT EXISTS roadmap_preview_url text,
  ADD COLUMN IF NOT EXISTS roadmap_gif_url     text;

COMMIT;
