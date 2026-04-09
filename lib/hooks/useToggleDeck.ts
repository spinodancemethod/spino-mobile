import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { showSnack } from 'lib/snackbarService';
import { useAuth } from 'lib/auth';
import { queryKeys } from 'lib/queryKeys';
import {
    createToggleMutationLifecycle,
    isVideosByIdsQueryForIds,
    ToggleMutationContext,
} from './toggleMutationUtils';
import { requireUserId, resolveUserId } from './userId';

/**
 * useToggleDeck
 * - Toggle a deck entry for current user: insert if missing, delete if present.
 * - Performs optimistic cache updates on ['deck', userId||'current'] which stores an array of video_ids.
 */
export function useToggleDeck(userId?: string | null) {
    const qc = useQueryClient();
    const { user } = useAuth();
    const resolvedUserId = resolveUserId(userId, user?.id);
    const key = queryKeys.deck(resolvedUserId);
    const toggleLifecycle = createToggleMutationLifecycle({
        queryClient: qc,
        primaryKey: key,
        shouldUpdateVideosQuery: (queryKey, previousIds) => isVideosByIdsQueryForIds(queryKey, previousIds),
    });

    return useMutation({
        mutationFn: async (videoId: string) => {
            const actualUserId = requireUserId(userId, user?.id);

            // Use RPC with advisory lock + server-side limit logic to avoid race conditions.
            const { data, error } = await supabase.rpc('toggle_deck_with_subscription_limit', {
                p_user: actualUserId,
                p_video: videoId,
            });

            if (error) {
                const message = error.message ?? 'Failed to toggle deck';
                if (message.toLowerCase().includes('deck limit reached')) {
                    // Server enforces tier-aware limits (free vs subscribed).
                    showSnack('Deck limit reached for your current plan.', { duration: 3000 });
                    const err = new Error('deck limit reached') as Error & { code?: string };
                    err.code = 'DECK_LIMIT';
                    throw err;
                }

                throw error;
            }

            const action = data === 'deleted' ? 'deleted' : 'inserted';
            return { action: action as 'deleted' | 'inserted' };
        },
        onMutate: toggleLifecycle.onMutate,
        onError: (err, videoId, context) => {
            toggleLifecycle.onError(err, videoId, context as ToggleMutationContext | undefined);
            console.warn('[useToggleDeck] error', err);
        },
        onSettled: toggleLifecycle.onSettled,
    });
}
