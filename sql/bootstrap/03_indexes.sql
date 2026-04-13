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

CREATE INDEX IF NOT EXISTS user_video_progress_video_id_idx
  ON public.user_video_progress (video_id);

CREATE INDEX IF NOT EXISTS user_video_progress_user_status_idx
  ON public.user_video_progress (user_id, status);
