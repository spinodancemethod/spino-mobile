-- 01_tables.sql
-- Base tables and core constraints for the public schema.
-- Run as a privileged role (for example, postgres/service_role).

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);

-- Stores metadata and local media references; source video files remain on the user's device.
CREATE TABLE IF NOT EXISTS public.user_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_roadmaps_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT user_roadmaps_user_name_unique UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  roadmap_id uuid NOT NULL REFERENCES public.user_roadmaps (id) ON DELETE CASCADE,
  local_reference_key text NOT NULL,
  platform text NOT NULL,
  media_identifier text,
  fallback_uri text,
  name text,
  filename text,
  custom_title text,
  duration_seconds double precision,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  creation_time timestamptz,
  thumbnail_reference text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  replacement_review_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT video_uploads_status_check CHECK (status IN ('AVAILABLE', 'MISSING', 'ACCESS_DENIED', 'UNKNOWN')),
  CONSTRAINT video_uploads_local_reference_key_check CHECK (length(trim(local_reference_key)) > 0),
  CONSTRAINT video_uploads_user_local_reference_key_unique UNIQUE (user_id, local_reference_key),
  CONSTRAINT video_uploads_custom_title_check CHECK (custom_title IS NULL OR length(trim(custom_title)) > 0)
);

CREATE TABLE IF NOT EXISTS public.video_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  roadmap_id uuid NOT NULL REFERENCES public.user_roadmaps (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_category boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT video_categories_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT video_categories_system_owner_check CHECK ((system_category AND user_id IS NULL) OR (NOT system_category AND user_id IS NOT NULL)),
  CONSTRAINT video_categories_misc_reserved_check CHECK (system_category OR lower(trim(name)) <> 'misc')
);

INSERT INTO public.video_categories (user_id, roadmap_id, name, system_category)
SELECT NULL, ur.id, 'Misc', true
FROM public.user_roadmaps ur
WHERE NOT EXISTS (
  SELECT 1
  FROM public.video_categories vc
  WHERE vc.roadmap_id = ur.id
    AND lower(trim(vc.name)) = 'misc'
)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_upload_id uuid NOT NULL REFERENCES public.video_uploads (id) ON DELETE CASCADE,
  sequence integer,
  start_time double precision NOT NULL,
  end_time double precision NOT NULL,
  count_start integer,
  count_end integer,
  category_id uuid NOT NULL REFERENCES public.video_categories (id) ON DELETE CASCADE,
  title text,
  thumbnail_reference text,
  user_notes text,
  ai_confidence double precision,
  ai_generated boolean NOT NULL DEFAULT false,
  user_confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT segments_time_order_check CHECK (start_time >= 0 AND start_time < end_time),
  CONSTRAINT segments_confidence_check CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  CONSTRAINT segments_title_non_empty_check CHECK (title IS NULL OR length(trim(title)) > 0)
);

-- Stores per-user status for each uploaded segment in the category roadmap flow.
CREATE TABLE IF NOT EXISTS public.user_segment_progress (
  user_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_segment_progress_pkey PRIMARY KEY (user_id, segment_id),
  CONSTRAINT user_segment_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_segment_progress_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments (id) ON DELETE CASCADE,
  CONSTRAINT user_segment_progress_status_check CHECK (
    status IN ('not_started', 'in_progress', 'completed')
  )
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'google_play',
  provider_subscription_id text,
  product_id text,
  base_plan_id text,
  offer_id text,
  order_id text,
  purchase_token text,
  acknowledged boolean,
  auto_renewing boolean,
  latest_purchase_at timestamptz,
  canceled_at timestamptz,
  entitlement_source text,
  -- RevenueCat webhook upserts use ON CONFLICT(provider, provider_subscription_id).
  -- Keep this as a table-level unique constraint (not a partial index) so
  -- conflict resolution works for non-null provider subscription ids.
  CONSTRAINT subscriptions_provider_provider_subscription_id_key UNIQUE (provider, provider_subscription_id),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'expired',
      'grace_period',
      'on_hold',
      'paused',
      'revoked',
      'pending'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.billing_provider_accounts (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_provider_accounts_provider_check CHECK (provider IN ('google_play', 'revenuecat')),
  CONSTRAINT billing_provider_accounts_user_provider_unique UNIQUE (user_id, provider),
  CONSTRAINT billing_provider_accounts_provider_account_unique UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_events_provider_check CHECK (provider IN ('google_play', 'revenuecat')),
  CONSTRAINT billing_events_provider_event_unique UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  context text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
