import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { supabase } from '../supabase'
import { completedVideoIdsQueryKey } from './useCompletedVideoIdsByUser'

type ToggleVideoCompletionPayload = {
    videoId: string;
    isComplete: boolean;
}

export function useToggleVideoCompletion(userId?: string | null) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const resolvedUserId = userId ?? user?.id ?? null
    const queryKey = completedVideoIdsQueryKey(resolvedUserId)

    return useMutation({
        mutationFn: async ({ videoId, isComplete }: ToggleVideoCompletionPayload) => {
            let actualUserId = userId ?? user?.id ?? null
            if (!actualUserId) {
                const { data: userData, error: userError } = await supabase.auth.getUser()
                if (userError) throw userError
                actualUserId = userData?.user?.id ?? null
            }

            if (!actualUserId) throw new Error('No authenticated user available')

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
        onMutate: async ({ videoId, isComplete }: ToggleVideoCompletionPayload) => {
            await queryClient.cancelQueries({ queryKey })

            const previous = queryClient.getQueryData<string[]>(queryKey) || []
            const next = isComplete
                ? previous.filter((currentVideoId) => currentVideoId !== videoId)
                : Array.from(new Set([...previous, videoId]))

            queryClient.setQueryData(queryKey, next)
            return { previous }
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey })
        },
    })
}