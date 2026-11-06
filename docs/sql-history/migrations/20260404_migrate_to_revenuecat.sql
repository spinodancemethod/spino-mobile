-- Prepare billing tables for a RevenueCat-first subscription flow.
--
-- This migration keeps the existing subscriptions table intact, but widens
-- provider checks on the billing support tables so they can store either
-- direct Google Play events or RevenueCat-managed billing events during the
-- cutover.
--
-- It also removes the Google Play-specific purchase token unique index because
-- RevenueCat no longer depends on purchase_token as the primary subscription
-- identity in the app runtime.

BEGIN;

-- 1. Expand provider validation on billing_provider_accounts.
--    RevenueCat can now be stored alongside legacy Google Play provider rows.
ALTER TABLE public.billing_provider_accounts
  DROP CONSTRAINT IF EXISTS billing_provider_accounts_provider_check;

ALTER TABLE public.billing_provider_accounts
  ADD CONSTRAINT billing_provider_accounts_provider_check
  CHECK (provider IN ('google_play', 'revenuecat'));

-- 2. Expand provider validation on billing_events.
--    This allows webhook/idempotency rows from RevenueCat to coexist with any
--    remaining legacy Google Play event rows during the transition.
ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_provider_check;

ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_provider_check
  CHECK (provider IN ('google_play', 'revenuecat'));

-- 3. Remove the Google-specific purchase token unique index.
--    RevenueCat-managed subscriptions are keyed by provider/customer/event data
--    rather than a Google Play purchase token, so this index no longer matches
--    the billing model we are standardizing on.
DROP INDEX IF EXISTS public.subscriptions_google_play_purchase_token_uidx;

COMMIT;