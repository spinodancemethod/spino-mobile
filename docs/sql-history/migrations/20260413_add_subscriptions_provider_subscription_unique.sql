-- Ensure RevenueCat webhook upserts can use ON CONFLICT(provider, provider_subscription_id).
--
-- Existing environments might only have a partial unique index on
-- (provider, provider_subscription_id), which is not sufficient for a plain
-- ON CONFLICT(column_list) target used by ingest-revenuecat-webhook.

BEGIN;

-- Drop legacy partial index if it exists. The table-level unique constraint
-- below supersedes it and allows standard ON CONFLICT usage.
DROP INDEX IF EXISTS public.subscriptions_provider_subscription_uidx;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_provider_subscription_id_key
  UNIQUE (provider, provider_subscription_id);

COMMIT;
