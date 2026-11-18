-- Preserve a video upload's stable identity while allowing its local device
-- reference to be recovered or relinked later.
BEGIN;

ALTER TABLE public.video_uploads
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS content_hash text;

-- Existing source files are device-local, so a migration cannot calculate a
-- trustworthy hash. Retain null until the device can establish one locally.
UPDATE public.video_uploads
SET original_filename = COALESCE(
  NULLIF(trim(filename), ''),
  NULLIF(trim(name), '')
)
WHERE original_filename IS NULL;

ALTER TABLE public.video_uploads
  DROP CONSTRAINT IF EXISTS video_uploads_original_filename_check;
ALTER TABLE public.video_uploads
  ADD CONSTRAINT video_uploads_original_filename_check
  CHECK (original_filename IS NULL OR length(trim(original_filename)) > 0);

ALTER TABLE public.video_uploads
  DROP CONSTRAINT IF EXISTS video_uploads_content_hash_check;
ALTER TABLE public.video_uploads
  ADD CONSTRAINT video_uploads_content_hash_check
  CHECK (content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$');

COMMIT;