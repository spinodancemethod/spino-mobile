-- Fable v2 Prompt 11: job recovery and limits.
-- * A job stuck in 'processing' (worker died) is put back in the queue after a timeout.
-- * A job that has been attempted too often is failed instead of looping forever.
-- * The audio bucket is swept by the worker (storage objects cannot be deleted
--   safely from SQL); this file only adds the SQL side.

BEGIN;

CREATE OR REPLACE FUNCTION public.requeue_stale_analysis_jobs(p_stale_after interval DEFAULT interval '15 minutes', p_max_attempts integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requeued integer := 0;
  v_failed integer := 0;
BEGIN
  -- Too many attempts: give up and tell the user.
  WITH f AS (
    UPDATE public.analysis_jobs
    SET status = 'failed', finished_at = timezone('utc'::text, now()),
        error = coalesce(error, '') || ' [gave up after ' || attempts || ' attempts]'
    WHERE status = 'processing' AND started_at < timezone('utc'::text, now()) - p_stale_after
      AND attempts >= p_max_attempts
    RETURNING video_upload_id
  )
  UPDATE public.video_uploads v SET analysis_status = 'failed', updated_at = timezone('utc'::text, now())
  FROM f WHERE v.id = f.video_upload_id;
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  -- Otherwise back to the queue for another worker/attempt.
  UPDATE public.analysis_jobs
  SET status = 'queued', worker_id = NULL, started_at = NULL
  WHERE status = 'processing' AND started_at < timezone('utc'::text, now()) - p_stale_after
    AND attempts < p_max_attempts;
  GET DIAGNOSTICS v_requeued = ROW_COUNT;
  RETURN v_requeued + v_failed;
END;
$$;
REVOKE ALL ON FUNCTION public.requeue_stale_analysis_jobs(interval, integer) FROM PUBLIC, anon, authenticated;

-- Users may re-queue a failed video; 'none' and 'failed' are the only states the
-- app offers "Find counts" for, and the partial unique index already blocks a
-- second live job. Nothing else to add here.

COMMIT;
