import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { supabase } from '../supabase'
import { createIdsOnlyToggleMutationLifecycle, IdsOnlyToggleMutationContext } from './toggleMutationUtils'
import { requireUserId, resolveUserId } from './userId'
import { completedSegmentIdsQueryKey } from './useCompletedSegmentIdsByUser'

type ToggleSegmentCompletionPayload = {
    segmentId: string
    isComplete: boolean
}

export function useToggleSegmentCompletion(userId?: string | null) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const resolvedUserId = resolveUserId(userId, user?.id)
    const queryKey = completedSegmentIdsQueryKey(resolvedUserId)
    const toggleLifecycle = createIdsOnlyToggleMutationLifecycle<ToggleSegmentCompletionPayload>({
        queryClient,
        primaryKey: queryKey,
        getNextIds: (previous, { segmentId, isComplete }) => {
            return isComplete
                ? previous.filter((currentSegmentId) => currentSegmentId !== segmentId)
                : Array.from(new Set([...previous, segmentId]))
        },
    })

    return useMutation({
        mutationFn: async ({ segmentId, isComplete }: ToggleSegmentCompletionPayload) => {
            const actualUserId = requireUserId(userId, user?.id)

            if (isComplete) {
                const { error } = await supabase
                    .from('user_segment_progress')
                    .delete()
                    .eq('user_id', actualUserId)
                    .eq('segment_id', segmentId)

                if (error) throw error
                return { action: 'deleted' as const, segmentId }
            }

            const now = new Date().toISOString()
            const row = {
                user_id: actualUserId,
                segment_id: segmentId,
                status: 'completed',
                started_at: now,
                completed_at: now,
                updated_at: now,
            }

            const { error } = await supabase
                .from('user_segment_progress')
                .upsert(row, { onConflict: 'user_id,segment_id' })

            if (error) throw error
            return { action: 'upserted' as const, segmentId }
        },
        onMutate: toggleLifecycle.onMutate,
        onError: (error, variables, context) => {
            toggleLifecycle.onError(error, variables, context as IdsOnlyToggleMutationContext | undefined)
        },
        onSettled: () => {
            toggleLifecycle.onSettled()
            // Keep roadmap tiles fresh after toggling completion in detail view.
            queryClient.invalidateQueries({ queryKey: ['roadmapSegments'] })
        },
    })
}
