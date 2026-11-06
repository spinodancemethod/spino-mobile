-- Add Video reuses a finished analysis for the same file (by sampled fingerprint).
CREATE INDEX IF NOT EXISTS video_uploads_user_content_hash_idx
  ON public.video_uploads (user_id, content_hash)
  WHERE content_hash IS NOT NULL;
