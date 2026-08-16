-- 03_indexes.sql
-- Secondary indexes and partial unique indexes for query performance/idempotency.

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS subscriptions_provider_user_idx
  ON public.subscriptions (provider, user_id);

CREATE INDEX IF NOT EXISTS subscriptions_status_period_idx
  ON public.subscriptions (status, current_period_end DESC);

CREATE INDEX IF NOT EXISTS billing_provider_accounts_user_idx
  ON public.billing_provider_accounts (user_id);

CREATE INDEX IF NOT EXISTS billing_events_processed_idx
  ON public.billing_events (provider, processed_at DESC);

CREATE INDEX IF NOT EXISTS client_error_logs_created_idx
  ON public.client_error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS client_error_logs_context_idx
  ON public.client_error_logs (context);

CREATE INDEX IF NOT EXISTS user_segment_progress_segment_id_idx
  ON public.user_segment_progress (segment_id);

CREATE INDEX IF NOT EXISTS user_segment_progress_user_status_idx
  ON public.user_segment_progress (user_id, status);

CREATE INDEX IF NOT EXISTS video_uploads_user_updated_idx
  ON public.video_uploads (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_roadmaps_user_updated_idx
  ON public.user_roadmaps (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS video_uploads_roadmap_idx
  ON public.video_uploads (user_id, roadmap_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS video_categories_roadmap_name_idx
  ON public.video_categories (roadmap_id, lower(name));

CREATE INDEX IF NOT EXISTS segments_user_video_idx
  ON public.segments (user_id, video_upload_id, sequence, created_at);

CREATE INDEX IF NOT EXISTS segments_category_idx
  ON public.segments (user_id, category_id);
