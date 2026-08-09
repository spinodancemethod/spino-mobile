-- 04_rls_policies_grants.sql
-- RLS, policies, and grants. Run after tables/functions exist.

BEGIN;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
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
    WHERE schemaname = 'public' AND tablename = 'billing_events' AND policyname = 'billing_events_service_role_all'
  ) THEN
    CREATE POLICY billing_events_service_role_all
      ON public.billing_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
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
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_select_own'
  ) THEN
    CREATE POLICY user_video_progress_select_own
      ON public.user_video_progress
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_insert_own'
  ) THEN
    CREATE POLICY user_video_progress_insert_own
      ON public.user_video_progress
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_update_own'
  ) THEN
    CREATE POLICY user_video_progress_update_own
      ON public.user_video_progress
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_video_progress' AND policyname = 'user_video_progress_delete_own'
  ) THEN
    CREATE POLICY user_video_progress_delete_own
      ON public.user_video_progress
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_segment_progress' AND policyname = 'user_segment_progress_select_own'
  ) THEN
    CREATE POLICY user_segment_progress_select_own
      ON public.user_segment_progress
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_segment_progress' AND policyname = 'user_segment_progress_insert_own'
  ) THEN
    CREATE POLICY user_segment_progress_insert_own
      ON public.user_segment_progress
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_segment_progress' AND policyname = 'user_segment_progress_update_own'
  ) THEN
    CREATE POLICY user_segment_progress_update_own
      ON public.user_segment_progress
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_segment_progress' AND policyname = 'user_segment_progress_delete_own'
  ) THEN
    CREATE POLICY user_segment_progress_delete_own
      ON public.user_segment_progress
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.positions;
  DROP POLICY IF EXISTS "public can read positions" ON public.positions;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'positions' AND policyname = 'positions_select_tier_access'
  ) THEN
    CREATE POLICY positions_select_tier_access
      ON public.positions
      FOR SELECT
      TO authenticated
      USING (public.can_access_position(auth.uid(), id));
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

  -- Drop the old binary-subscription-only policy if it still exists from before the free-tier migration.
  DROP POLICY IF EXISTS videos_select_active_subscription ON public.videos;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_select_tier_access'
  ) THEN
    -- Allows SELECT when the user has an active subscription OR the video is free-tier.
    CREATE POLICY videos_select_tier_access
      ON public.videos
      FOR SELECT
      TO authenticated
      USING (public.can_access_video(auth.uid(), id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_select_own') THEN
    CREATE POLICY user_roadmaps_select_own ON public.user_roadmaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_insert_own') THEN
    CREATE POLICY user_roadmaps_insert_own ON public.user_roadmaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_update_own') THEN
    CREATE POLICY user_roadmaps_update_own ON public.user_roadmaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roadmaps' AND policyname = 'user_roadmaps_delete_own') THEN
    CREATE POLICY user_roadmaps_delete_own ON public.user_roadmaps FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_select_available') THEN
    CREATE POLICY video_categories_select_available ON public.video_categories FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_roadmaps ur
        WHERE ur.id = roadmap_id AND ur.user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_insert_own') THEN
    CREATE POLICY video_categories_insert_own ON public.video_categories FOR INSERT TO authenticated
      WITH CHECK (
        system_category = false
        AND auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.user_roadmaps ur
          WHERE ur.id = roadmap_id AND ur.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_update_own') THEN
    CREATE POLICY video_categories_update_own ON public.video_categories FOR UPDATE TO authenticated
      USING (
        system_category = false
        AND auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.user_roadmaps ur
          WHERE ur.id = roadmap_id AND ur.user_id = auth.uid()
        )
      )
      WITH CHECK (
        system_category = false
        AND auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.user_roadmaps ur
          WHERE ur.id = roadmap_id AND ur.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'video_categories' AND policyname = 'video_categories_delete_own') THEN
    CREATE POLICY video_categories_delete_own ON public.video_categories FOR DELETE TO authenticated
      USING (
        system_category = false
        AND auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.user_roadmaps ur
          WHERE ur.id = roadmap_id AND ur.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments' AND policyname = 'segments_select_own') THEN
    CREATE POLICY segments_select_own ON public.segments FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments' AND policyname = 'segments_insert_own') THEN
    CREATE POLICY segments_insert_own ON public.segments FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND EXISTS (
        SELECT 1
        FROM public.video_uploads
        JOIN public.video_categories ON video_categories.id = category_id
        WHERE video_uploads.id = video_upload_id
          AND video_uploads.user_id = auth.uid()
          AND video_categories.roadmap_id = video_uploads.roadmap_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments' AND policyname = 'segments_update_own') THEN
    CREATE POLICY segments_update_own ON public.segments FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id AND EXISTS (
        SELECT 1
        FROM public.video_uploads
        JOIN public.video_categories ON video_categories.id = category_id
        WHERE video_uploads.id = video_upload_id
          AND video_uploads.user_id = auth.uid()
          AND video_categories.roadmap_id = video_uploads.roadmap_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segments' AND policyname = 'segments_delete_own') THEN
    CREATE POLICY segments_delete_own ON public.segments FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_select_own'
  ) THEN
    CREATE POLICY video_uploads_select_own ON public.video_uploads
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_insert_own'
  ) THEN
    CREATE POLICY video_uploads_insert_own ON public.video_uploads
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_update_own'
  ) THEN
    CREATE POLICY video_uploads_update_own ON public.video_uploads
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_uploads' AND policyname = 'video_uploads_delete_own'
  ) THEN
    CREATE POLICY video_uploads_delete_own ON public.video_uploads
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Least-privilege grants: authenticated users get only the permissions required by RLS policies.
-- Avoid broad grants to reduce blast radius; service_role retains admin privileges.

-- Authenticated user grants (minimal per-table permissions)
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.billing_provider_accounts TO authenticated;
GRANT SELECT ON public.client_error_logs TO authenticated;
GRANT INSERT ON public.client_error_logs TO authenticated;
GRANT SELECT ON public.deck TO authenticated;
GRANT INSERT ON public.deck TO authenticated;
GRANT DELETE ON public.deck TO authenticated;
GRANT SELECT ON public.favourites TO authenticated;
GRANT INSERT ON public.favourites TO authenticated;
GRANT DELETE ON public.favourites TO authenticated;
GRANT SELECT ON public.notes TO authenticated;
GRANT INSERT ON public.notes TO authenticated;
GRANT UPDATE ON public.notes TO authenticated;
GRANT DELETE ON public.notes TO authenticated;
GRANT SELECT ON public.positions TO authenticated;
GRANT SELECT ON public.user_video_progress TO authenticated;
GRANT INSERT ON public.user_video_progress TO authenticated;
GRANT UPDATE ON public.user_video_progress TO authenticated;
GRANT DELETE ON public.user_video_progress TO authenticated;
GRANT SELECT ON public.user_segment_progress TO authenticated;
GRANT INSERT ON public.user_segment_progress TO authenticated;
GRANT UPDATE ON public.user_segment_progress TO authenticated;
GRANT DELETE ON public.user_segment_progress TO authenticated;
GRANT SELECT ON public.video_uploads TO authenticated;
GRANT INSERT ON public.video_uploads TO authenticated;
GRANT UPDATE ON public.video_uploads TO authenticated;
GRANT DELETE ON public.video_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roadmaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT INSERT ON public.user_profiles TO authenticated;
GRANT UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.videos TO authenticated;
GRANT INSERT ON public.videos TO authenticated;
GRANT UPDATE ON public.videos TO authenticated;
GRANT DELETE ON public.videos TO authenticated;

-- Sequence grants for authenticated (only USAGE needed, not ALL)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Admin video management and storage upload policies
DO $$
BEGIN
  -- Admin: full SELECT bypass (admin is not a subscriber, so tier checks block them otherwise)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_select_admin'
  ) THEN
    CREATE POLICY videos_select_admin ON public.videos
      FOR SELECT TO authenticated
      USING ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'positions' AND policyname = 'positions_select_admin'
  ) THEN
    CREATE POLICY positions_select_admin ON public.positions
      FOR SELECT TO authenticated
      USING ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  -- Admin: insert/update videos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_insert_admin'
  ) THEN
    CREATE POLICY videos_insert_admin ON public.videos
      FOR INSERT TO authenticated
      WITH CHECK ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'videos_update_admin'
  ) THEN
    CREATE POLICY videos_update_admin ON public.videos
      FOR UPDATE TO authenticated
      USING ((auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  -- Storage: all authenticated users can read from the videos bucket (enables signed URL generation)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'videos_bucket_select_authenticated'
  ) THEN
    CREATE POLICY videos_bucket_select_authenticated
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'videos');
  END IF;

  -- Storage: admin can upload to all three buckets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'videos_bucket_insert_admin'
  ) THEN
    CREATE POLICY videos_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'videos' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'thumbnails_bucket_insert_admin'
  ) THEN
    CREATE POLICY thumbnails_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'thumbnails' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'roadmap_previews_bucket_insert_admin'
  ) THEN
    CREATE POLICY roadmap_previews_bucket_insert_admin
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'roadmap-previews' AND (auth.jwt() ->> 'email') = 'spino@spino.com');
  END IF;
END $$;

-- Service role retains full admin privileges for backend operations
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Function grants
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_position(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_position(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_deck_with_subscription_limit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_deck_with_subscription_limit(uuid, uuid) TO service_role;

COMMIT;
