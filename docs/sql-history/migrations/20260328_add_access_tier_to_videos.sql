-- Add access_tier to videos so individual videos can be designated free or paid.
-- 'free'  — visible to all authenticated users regardless of subscription.
-- 'paid'  — requires an active subscription (existing behaviour, kept as default).
-- All existing rows receive 'paid' so there is no change to current entitlement.

BEGIN;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'paid';

-- Enforce the only two legal values.
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_access_tier_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_access_tier_check
    CHECK (access_tier IN ('free', 'paid'));

COMMIT;
