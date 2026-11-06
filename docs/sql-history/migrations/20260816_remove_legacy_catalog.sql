-- Remove the legacy catalog/admin video system.
-- Apply only after confirming legacy catalog data and storage objects are no longer needed.

BEGIN;

-- Remove RLS policies that reference the access helpers before dropping them.
DROP POLICY IF EXISTS videos_select_tier_access ON public.videos;
DROP POLICY IF EXISTS videos_select_active_subscription ON public.videos;
DROP POLICY IF EXISTS "Users can create videos" ON public.videos;
DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can delete their own videos" ON public.videos;
DROP POLICY IF EXISTS videos_select_admin ON public.videos;
DROP POLICY IF EXISTS videos_insert_admin ON public.videos;
DROP POLICY IF EXISTS videos_update_admin ON public.videos;
DROP POLICY IF EXISTS positions_select_tier_access ON public.positions;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.positions;
DROP POLICY IF EXISTS "public can read positions" ON public.positions;
DROP POLICY IF EXISTS positions_select_admin ON public.positions;

DROP FUNCTION IF EXISTS public.can_access_video(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_access_position(uuid, uuid);

DROP TABLE IF EXISTS public.user_video_progress;
DROP TABLE IF EXISTS public.favourites;
DROP TABLE IF EXISTS public.notes;
DROP TABLE IF EXISTS public.videos;
DROP TABLE IF EXISTS public.positions;

DROP SEQUENCE IF EXISTS public.likes_id_seq;
DROP SEQUENCE IF EXISTS public.positions_order_seq;
DROP SEQUENCE IF EXISTS public.deck_id_seq;

DROP POLICY IF EXISTS videos_bucket_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS videos_bucket_insert_admin ON storage.objects;
DROP POLICY IF EXISTS thumbnails_bucket_insert_admin ON storage.objects;
DROP POLICY IF EXISTS roadmap_previews_bucket_insert_admin ON storage.objects;

COMMIT;
