import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

/**
 * useToggleFavourite
 * - Optimistically toggles a favourite for the current (or provided) user.
 * - Uses the cached `['favourites', userId || 'current']` data (an array of video_ids)
 *   to determine whether to insert or delete.
 * - Updates the cache immediately and rolls back on error.
 */
export function useToggleFavourite(userId?: string | null) {
    const qc = useQueryClient();
    const key = ['favourites', userId || 'current'];

    return useMutation({
        mutationFn: async (videoId: string) => {
            // NOTE: Development convenience - a hard-coded test user id is used here
            // so you can toggle favourites during local development without a real
            // authenticated session. Keep this in place for dev; replace or remove
            // before shipping to production.
            let actualUserId: any = "371b9ee4-3660-4deb-bbfb-b0f7d77e8962";
            // If for some reason the hard-coded id is empty, fall back to auth
            if (!actualUserId) {
                const { data: ud } = await supabase.auth.getUser();
                actualUserId = ud?.user?.id;
            }

            // Check existing favourite
            const { data: existing, error: fetchErr } = await supabase
                .from('favourites')
                .select('id')
                .eq('video_id', videoId)
                .eq('user_id', actualUserId)
                .maybeSingle();
            if (fetchErr) throw fetchErr;

            if (existing && (existing as any).id) {
                // delete
                const { error: delErr } = await supabase
                    .from('favourites')
                    .delete()
                    .eq('video_id', videoId)
                    .eq('user_id', actualUserId);
                if (delErr) throw delErr;
                return { action: 'deleted' as const };
            }

            // insert
            const { error: insErr } = await supabase.from('favourites').insert({ video_id: videoId, user_id: actualUserId });
            if (insErr) throw insErr;
            return { action: 'inserted' as const };
        },
        onMutate: async (videoId: string) => {
            // Optimistic update: update favourites cache and also remove the
            // video from any cached videos lists so UI doesn't flash empty.
            await qc.cancelQueries({ queryKey: key });
            await qc.cancelQueries({ queryKey: ['videosByIds'] });

            const previous = qc.getQueryData<string[]>(key) || [];
            const exists = previous.includes(videoId);
            const next = exists ? previous.filter((id) => id !== videoId) : [...previous, videoId];
            qc.setQueryData(key, next);

            // Snapshot and update videosByIds caches
            const videosQueries = qc.getQueriesData({ queryKey: ['videosByIds'] }) || [];
            const previousVideos: Record<string, any> = {};
            for (const [qk] of videosQueries) {
                try {
                    const cacheKey = qk as any;
                    const old = qc.getQueryData(cacheKey as any);
                    previousVideos[JSON.stringify(cacheKey)] = old;
                    if (Array.isArray(old)) {
                        const filtered = (old as any[]).filter(v => v.id !== videoId);
                        qc.setQueryData(cacheKey as any, filtered);
                    }
                } catch (e) {
                    // ignore any cache manipulation errors
                }
            }

            return { previous, previousVideos };
        },
        onError: (err, _videoId, context: any) => {
            // Rollback: restore favourites cache and any videos caches we modified.
            if (context?.previous) qc.setQueryData(key, context.previous);
            if (context?.previousVideos) {
                for (const k of Object.keys(context.previousVideos)) {
                    try {
                        const parsed = JSON.parse(k);
                        qc.setQueryData(parsed as any, context.previousVideos[k]);
                    } catch (e) {
                        // ignore
                    }
                }
            }
            console.warn('[useToggleFavourite] error', err);
        },
        onSettled: () => {
            // Revalidate in the background to ensure server and cache match.
            qc.invalidateQueries({ queryKey: key });
            qc.invalidateQueries({ queryKey: ['videosByIds'] });
        }
    });
}
