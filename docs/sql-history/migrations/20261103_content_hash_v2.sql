-- Fingerprints are now sampled (size + head/tail 1 MB) and prefixed 'v2-' (lib/videoHash.ts).
-- Keep accepting the legacy 64-hex whole-file hash for rows written before.
ALTER TABLE public.video_uploads DROP CONSTRAINT IF EXISTS video_uploads_content_hash_check;
ALTER TABLE public.video_uploads ADD CONSTRAINT video_uploads_content_hash_check
  CHECK (content_hash IS NULL OR content_hash ~ '^(v2-)?[a-f0-9]{64}$');
