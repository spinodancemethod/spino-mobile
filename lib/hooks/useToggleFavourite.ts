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
            // Optimistic update: immediately update local cache so UI responds
            // instantly. We cancel ongoing queries for the key, snapshot the
            // previous value, and then set the new value (add/remove id).
            await qc.cancelQueries({ queryKey: key });
            const previous = qc.getQueryData<string[]>(key) || [];
            const exists = previous.includes(videoId);
            const next = exists ? previous.filter((id) => id !== videoId) : [...previous, videoId];
            qc.setQueryData(key, next);
            // Return the previous cache snapshot so onError can rollback.
            return { previous };
        },
        onError: (err, _videoId, context: any) => {
            // Rollback: if the server call failed, restore the previous cache.
            if (context?.previous) qc.setQueryData(key, context.previous);
            console.warn('[useToggleFavourite] error', err);
        },
        onSettled: () => {
            // Revalidate in the background to ensure cache matches server state.
            qc.invalidateQueries({ queryKey: key });
        }
    });
}
