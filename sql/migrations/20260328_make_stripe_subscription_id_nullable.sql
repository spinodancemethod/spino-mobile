-- 20260328_make_stripe_subscription_id_nullable.sql
-- Production migration for Google Play rollout.
-- Allows non-Stripe providers to write subscription rows without a Stripe id.

BEGIN;

ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

COMMIT;
