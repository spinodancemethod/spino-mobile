-- 04_rls_policies_grants.sql
-- RLS, policies, and grants. Run after tables/functions exist.

BEGIN;

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_customers' AND policyname = 'billing_customers_select_own'
  ) THEN
    CREATE POLICY billing_customers_select_own
      ON public.billing_customers
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_select_own'
  ) THEN
    CREATE POLICY subscriptions_select_own
      ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_provider_accounts' AND policyname = 'billing_provider_accounts_select_own'
  ) THEN
    CREATE POLICY billing_provider_accounts_select_own
      ON public.billing_provider_accounts
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_error_logs' AND policyname = 'client_error_logs_insert_own'
  ) THEN
    CREATE POLICY client_error_logs_insert_own
      ON public.client_error_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_error_logs' AND policyname = 'client_error_logs_select_own'
  ) THEN
    CREATE POLICY client_error_logs_select_own
      ON public.client_error_logs
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deck' AND policyname = 'deck_select_owner'
  ) THEN
    CREATE POLICY deck_select_owner
      ON public.deck
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deck' AND policyname = 'deck_insert_owner'
  ) THEN
    CREATE POLICY deck_insert_owner
      ON public.deck
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deck' AND policyname = 'deck_delete_owner'
  ) THEN
    CREATE POLICY deck_delete_owner
      ON public.deck
      FOR DELETE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favourites' AND policyname = 'favourites_select_owner'
  ) THEN
    CREATE POLICY favourites_select_owner
      ON public.favourites
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favourites' AND policyname = 'favourites_insert_owner'
  ) THEN
    CREATE POLICY favourites_insert_owner
      ON public.favourites
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favourites' AND policyname = 'favourites_delete_owner'
  ) THEN
    CREATE POLICY favourites_delete_owner
      ON public.favourites
      FOR DELETE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes' AND policyname = 'Select own notes'
  ) THEN
    CREATE POLICY "Select own notes"
      ON public.notes
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes' AND policyname = 'Insert own notes'
  ) THEN
    CREATE POLICY "Insert own notes"
      ON public.notes
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes' AND policyname = 'Update own notes'
  ) THEN
    CREATE POLICY "Update own notes"
      ON public.notes
      FOR UPDATE
      TO public
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes' AND policyname = 'Delete own notes'
  ) THEN
    CREATE POLICY "Delete own notes"
      ON public.notes
      FOR DELETE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'positions' AND policyname = 'Categories are viewable by everyone'
  ) THEN
    CREATE POLICY "Categories are viewable by everyone"
      ON public.positions
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'positions' AND policyname = 'public can read positions'
  ) THEN
    CREATE POLICY "public can read positions"
      ON public.positions
      FOR SELECT
      TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone"
      ON public.user_profiles
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can create their own profile'
  ) THEN
    CREATE POLICY "Users can create their own profile"
      ON public.user_profiles
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.user_profiles
      FOR UPDATE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can create videos'
  ) THEN
    CREATE POLICY "Users can create videos"
      ON public.videos
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can update their own videos'
  ) THEN
    CREATE POLICY "Users can update their own videos"
      ON public.videos
      FOR UPDATE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can delete their own videos'
  ) THEN
    CREATE POLICY "Users can delete their own videos"
      ON public.videos
      FOR DELETE
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_select_active_subscription'
  ) THEN
    CREATE POLICY videos_select_active_subscription
      ON public.videos
      FOR SELECT
      TO authenticated
      USING (public.has_active_subscription(auth.uid()));
  END IF;
END $$;

-- Keep authenticated/service_role broad grants for app compatibility.
-- Avoid broad anon grants; anonymous access should remain explicit and policy-driven.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_deck_with_subscription_limit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_deck_with_subscription_limit(uuid, uuid) TO service_role;

COMMIT;
