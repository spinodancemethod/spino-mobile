import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { supabase } from '../supabase'
import { createIdsOnlyToggleMutationLifecycle, IdsOnlyToggleMutationContext } from './toggleMutationUtils'
import { requireUserId, resolveUserId } from './userId'
import { completedVideoIdsQueryKey } from './useCompletedVideoIdsByUser'

type ToggleVideoCompletionPayload = {
    videoId: string;
    isComplete: boolean;
}

export function useToggleVideoCompletion(userId?: string | null) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const resolvedUserId = resolveUserId(userId, user?.id)
    const queryKey = completedVideoIdsQueryKey(resolvedUserId)
    const toggleLifecycle = createIdsOnlyToggleMutationLifecycle<ToggleVideoCompletionPayload>({
        queryClient,
        primaryKey: queryKey,
        getNextIds: (previous, { videoId, isComplete }) => {
            return isComplete
                ? previous.filter((currentVideoId) => currentVideoId !== videoId)
                : Array.from(new Set([...previous, videoId]))
        },
    })

    return useMutation({
        mutationFn: async ({ videoId, isComplete }: ToggleVideoCompletionPayload) => {
            const actualUserId = requireUserId(userId, user?.id)

            if (isComplete) {
                // The unchecked state is represented by the absence of a row.
                const { error } = await supabase
                    .from('user_video_progress')
                    .delete()
                    .eq('user_id', actualUserId)
                    .eq('video_id', videoId)

                if (error) throw error
                return { action: 'deleted' as const, videoId }
            }

            const now = new Date().toISOString()
            const row = {
                user_id: actualUserId,
                video_id: videoId,
                status: 'completed',
                started_at: now,
                completed_at: now,
                updated_at: now,
            }

            const { error } = await supabase
                .from('user_video_progress')
                .upsert(row, { onConflict: 'user_id,video_id' })

            if (error) throw error
            return { action: 'upserted' as const, videoId }
        },
        onMutate: toggleLifecycle.onMutate,
        onError: (error, variables, context) => {
            toggleLifecycle.onError(error, variables, context as IdsOnlyToggleMutationContext | undefined)
        },
        onSettled: toggleLifecycle.onSettled,
    })
}