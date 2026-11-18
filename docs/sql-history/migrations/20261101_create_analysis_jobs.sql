-- Fable v2: audio-only analysis jobs and the count grid stored on each video.
-- The video never leaves the phone; only its audio track is uploaded to a private
-- bucket, analysed by the worker, written back as `count_grid`, and deleted.

BEGIN;

-- 1. Count grid + analysis state on the video record -------------------------
ALTER TABLE public.video_uploads
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS analysis_mode text,
  ADD COLUMN IF NOT EXISTS count_grid jsonb,
  ADD COLUMN IF NOT EXISTS analysed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_uploads_analysis_status_check') THEN
    ALTER TABLE public.video_uploads
      ADD CONSTRAINT video_uploads_analysis_status_check
      CHECK (analysis_status IN ('none', 'queued', 'processing', 'ready', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_uploads_analysis_mode_check') THEN
    ALTER TABLE public.video_uploads
      ADD CONSTRAINT video_uploads_analysis_mode_check
      CHECK (analysis_mode IS NULL OR analysis_mode IN ('counting', 'music', 'none'));
  END IF;
END $$;

-- 2. Jobs table polled by the worker ------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_upload_id uuid NOT NULL REFERENCES public.video_uploads (id) ON DELETE CASCADE,
  -- Object path in the `analysis-audio` bucket: <user_id>/<job_id>.m4a
  audio_path text NOT NULL,
  duration_seconds double precision,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  worker_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT analysis_jobs_status_check CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  CONSTRAINT analysis_jobs_audio_path_check CHECK (length(trim(audio_path)) > 0)
);

-- One live job per video: a second tap while one is queued/processing is rejected.
CREATE UNIQUE INDEX IF NOT EXISTS analysis_jobs_one_active_per_video
  ON public.analysis_jobs (video_upload_id)
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS analysis_jobs_queue_idx
  ON public.analysis_jobs (status, created_at)
  WHERE status = 'queued';

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'analysis_jobs_select_own') THEN
    CREATE POLICY analysis_jobs_select_own ON public.analysis_jobs
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'analysis_jobs_insert_own') THEN
    -- A user may only queue a job for their own video.
    CREATE POLICY analysis_jobs_insert_own ON public.analysis_jobs
      FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = user_id
        AND status = 'queued'
        AND EXISTS (SELECT 1 FROM public.video_uploads v WHERE v.id = video_upload_id AND v.user_id = auth.uid())
      );
  END IF;
END $$;

GRANT SELECT ON public.analysis_jobs TO authenticated;
GRANT INSERT ON public.analysis_jobs TO authenticated;
-- Status transitions are made only by the worker (service_role bypasses RLS).

-- 3. Private storage bucket for the transient audio -----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('analysis-audio', 'analysis-audio', false, 20971520, ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- Users may only upload into their own folder; they never read or list it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'analysis_audio_insert_own_folder') THEN
    CREATE POLICY analysis_audio_insert_own_folder ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'analysis-audio'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- 4. Helper for the worker: atomically claim the oldest queued job -------------
CREATE OR REPLACE FUNCTION public.claim_analysis_job(p_worker_id text)
RETURNS SETOF public.analysis_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.analysis_jobs j
  SET status = 'processing', worker_id = p_worker_id, started_at = timezone('utc'::text, now()), attempts = attempts + 1
  WHERE j.id = (
    SELECT id FROM public.analysis_jobs
    WHERE status = 'queued'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_analysis_job(text) FROM PUBLIC, anon, authenticated;

-- 5. Finishing a job updates the video in the same statement ------------------
CREATE OR REPLACE FUNCTION public.finish_analysis_job(p_job_id uuid, p_grid jsonb, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video uuid;
BEGIN
  SELECT video_upload_id INTO v_video FROM public.analysis_jobs WHERE id = p_job_id;
  IF v_video IS NULL THEN
    RAISE EXCEPTION 'analysis job % not found', p_job_id;
  END IF;
  IF p_error IS NULL THEN
    UPDATE public.analysis_jobs SET status = 'done', finished_at = timezone('utc'::text, now()), error = NULL WHERE id = p_job_id;
    UPDATE public.video_uploads
      SET analysis_status = 'ready', analysis_mode = p_grid->>'mode', count_grid = p_grid,
          analysed_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
      WHERE id = v_video;
  ELSE
    UPDATE public.analysis_jobs SET status = 'failed', finished_at = timezone('utc'::text, now()), error = left(p_error, 2000) WHERE id = p_job_id;
    UPDATE public.video_uploads SET analysis_status = 'failed', updated_at = timezone('utc'::text, now()) WHERE id = v_video;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_analysis_job(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- 6. Queueing from the app: one RPC that inserts the job and flips the video status
CREATE OR REPLACE FUNCTION public.queue_analysis_job(p_video_upload_id uuid, p_audio_path text, p_duration_seconds double precision)
RETURNS public.analysis_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job public.analysis_jobs;
BEGIN
  INSERT INTO public.analysis_jobs (user_id, video_upload_id, audio_path, duration_seconds)
  VALUES (auth.uid(), p_video_upload_id, p_audio_path, p_duration_seconds)
  RETURNING * INTO v_job;
  UPDATE public.video_uploads SET analysis_status = 'queued', updated_at = timezone('utc'::text, now())
  WHERE id = p_video_upload_id AND user_id = auth.uid();
  RETURN v_job;
END;
$$;
GRANT EXECUTE ON FUNCTION public.queue_analysis_job(uuid, text, double precision) TO authenticated;

COMMIT;
