import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { showSnack } from 'lib/snackbarService';
import { DECK_LIMIT } from 'constants/Config';
import { useAuth } from 'lib/auth';
import { computeNextToggledIds } from './toggleMutationUtils';

/**
 * useToggleDeck
 * - Toggle a deck entry for current user: insert if missing, delete if present.
 * - Performs optimistic cache updates on ['deck', userId||'current'] which stores an array of video_ids.
 */
export function useToggleDeck(userId?: string | null) {
    const qc = useQueryClient();
    const { user, loading } = useAuth();
    const resolvedUserId = userId ?? user?.id ?? null;
    const key = ['deck', resolvedUserId];

    return useMutation({
        mutationFn: async (videoId: string) => {
            // Resolve user id from the provided param or the authenticated user
            let actualUserId: any = null;
            if (userId) actualUserId = userId;
            if (!actualUserId) {
                const { data: ud, error: ue } = await supabase.auth.getUser();
                if (ue) throw ue;
                actualUserId = ud?.user?.id;
            }

            if (!actualUserId) throw new Error('No authenticated user available');

            // Use RPC with advisory lock + server-side limit logic to avoid race conditions.
            const { data, error } = await supabase.rpc('toggle_deck_with_subscription_limit', {
                p_user: actualUserId,
                p_video: videoId,
            });

            if (error) {
                const message = error.message ?? 'Failed to toggle deck';
                if (message.toLowerCase().includes('deck limit reached')) {
                    showSnack(`You can only save up to ${DECK_LIMIT} classes.`, { duration: 3000 });
                    const err: any = new Error('deck limit reached');
                    err.code = 'DECK_LIMIT';
                    throw err;
                }

                throw error;
            }

            const action = data === 'deleted' ? 'deleted' : 'inserted';
            return { action: action as 'deleted' | 'inserted' };
        },
        onMutate: async (videoId: string) => {
            // Optimistic update: update deck cache and remove video from any
            // cached videosByIds entries so UI updates immediately.
            await qc.cancelQueries({ queryKey: key });
            await qc.cancelQueries({ queryKey: ['videosByIds'] });

            const previous = qc.getQueryData<string[]>(key) || [];
            const { next } = computeNextToggledIds(previous, videoId);
            qc.setQueryData(key, next);

            // Snapshot and update videosByIds caches, but only those that match
            // the current deck ids (previous). This prevents removing the video
            // from unrelated lists such as favourites.
            const videosQueries = qc.getQueriesData({ queryKey: ['videosByIds'] }) || [];
            const previousVideos: Record<string, any> = {};
            const prevKeyJson = JSON.stringify(previous);
            for (const [qk] of videosQueries) {
                try {
                    const cacheKey = qk as any;
                    const ids = Array.isArray(cacheKey) ? cacheKey[1] : undefined;
                    // Only modify cached videos lists that have the same ids as the previous deck
                    if (!ids || JSON.stringify(ids) !== prevKeyJson) continue;

                    const old = qc.getQueryData(cacheKey as any);
                    previousVideos[JSON.stringify(cacheKey)] = old;
                    if (Array.isArray(old)) {
                        const filtered = (old as any[]).filter(v => v.id !== videoId);
                        qc.setQueryData(cacheKey as any, filtered);
                    }
                } catch (e) {
                    // ignore
                }
            }

            return { previous, previousVideos };
        },
        onError: (err, _videoId, context: any) => {
            // Rollback
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
            console.warn('[useToggleDeck] error', err);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: key });
            qc.invalidateQueries({ queryKey: ['videosByIds'] });
        }
    });
}
