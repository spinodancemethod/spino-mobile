-- Add marker flag for position-specific video records.
-- Default to false for all existing and future rows.
ALTER TABLE public.videos
  ADD COLUMN is_position boolean NOT NULL DEFAULT false;
