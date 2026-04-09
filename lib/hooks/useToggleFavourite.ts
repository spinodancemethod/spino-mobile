import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from 'lib/auth';
import { createToggleMutationLifecycle, ToggleMutationContext } from './toggleMutationUtils';

/**
 * useToggleFavourite
 * - Optimistically toggles a favourite for the current (or provided) user.
 * - Uses the cached `['favourites', userId || 'current']` data (an array of video_ids)
 *   to determine whether to insert or delete.
 * - Updates the cache immediately and rolls back on error.
 */
export function useToggleFavourite(userId?: string | null) {
    const qc = useQueryClient();
    const { user } = useAuth();
    const resolvedUserId = userId ?? user?.id ?? null;
    const key = ['favourites', resolvedUserId];
    const toggleLifecycle = createToggleMutationLifecycle({
        queryClient: qc,
        primaryKey: key,
    });

    return useMutation({
        mutationFn: async (videoId: string) => {
            // Resolve user id: use provided userId param if present; otherwise
            // fall back to currently authenticated Supabase user.
            let actualUserId: any = null;
            if (userId) actualUserId = userId;
            if (!actualUserId) {
                const { data: ud, error: ue } = await supabase.auth.getUser();
                if (ue) throw ue;
                actualUserId = ud?.user?.id;
            }

            if (!actualUserId) throw new Error('No authenticated user available');

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
        onMutate: toggleLifecycle.onMutate,
        onError: (err, videoId, context) => {
            toggleLifecycle.onError(err, videoId, context as ToggleMutationContext | undefined);
            console.warn('[useToggleFavourite] error', err);
        },
        onSettled: toggleLifecycle.onSettled,
    });
}
