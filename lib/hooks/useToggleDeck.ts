import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { showSnack } from 'lib/snackbarService';
import { useAuth } from 'lib/auth';
import {
    createToggleMutationLifecycle,
    isVideosByIdsQueryForIds,
    ToggleMutationContext,
} from './toggleMutationUtils';

/**
 * useToggleDeck
 * - Toggle a deck entry for current user: insert if missing, delete if present.
 * - Performs optimistic cache updates on ['deck', userId||'current'] which stores an array of video_ids.
 */
export function useToggleDeck(userId?: string | null) {
    const qc = useQueryClient();
    const { user } = useAuth();
    const resolvedUserId = userId ?? user?.id ?? null;
    const key = ['deck', resolvedUserId];
    const toggleLifecycle = createToggleMutationLifecycle({
        queryClient: qc,
        primaryKey: key,
        shouldUpdateVideosQuery: (queryKey, previousIds) => isVideosByIdsQueryForIds(queryKey, previousIds),
    });

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
                    // Server enforces tier-aware limits (free vs subscribed).
                    showSnack('Deck limit reached for your current plan.', { duration: 3000 });
                    const err: any = new Error('deck limit reached');
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
