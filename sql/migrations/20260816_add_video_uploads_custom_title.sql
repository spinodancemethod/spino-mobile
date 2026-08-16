-- Adds a user-editable custom title to video_uploads, separate from the
-- device-derived filename stored in `name`/`filename`.
BEGIN;

ALTER TABLE public.video_uploads ADD COLUMN IF NOT EXISTS custom_title text;

ALTER TABLE public.video_uploads
  DROP CONSTRAINT IF EXISTS video_uploads_custom_title_check;
ALTER TABLE public.video_uploads
  ADD CONSTRAINT video_uploads_custom_title_check CHECK (custom_title IS NULL OR length(trim(custom_title)) > 0);

COMMIT;
