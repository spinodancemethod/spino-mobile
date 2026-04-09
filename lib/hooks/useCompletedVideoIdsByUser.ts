import { QueryFunctionContext, useQuery } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { VideoIdRow } from 'lib/models'
import { queryKeys } from 'lib/queryKeys'
import { supabase } from '../supabase'

export function completedVideoIdsQueryKey(userId?: string | null) {
    return queryKeys.completedVideoIds(userId)
}

type CompletedVideoIdsQueryKey = ReturnType<typeof completedVideoIdsQueryKey>

async function fetchCompletedVideoIds({ queryKey }: QueryFunctionContext<CompletedVideoIdsQueryKey>): Promise<string[]> {
    const [_key, userId] = queryKey

    let actualUserId: string | null = userId ?? null
    if (!actualUserId) {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        actualUserId = userData?.user?.id ?? null
    }

    if (!actualUserId) return []

    // Only completed rows are stored in the roadmap UI flow, so the query can stay narrow.
    const { data, error } = await supabase
        .from('user_video_progress')
        .select('video_id')
        .eq('user_id', actualUserId)
        .eq('status', 'completed')

    if (error) throw error
    return ((data || []) as VideoIdRow[]).map((row) => row.video_id)
}

export function useCompletedVideoIdsByUser(userId?: string | null) {
    const { user, loading } = useAuth()
    const resolvedUserId = userId ?? user?.id ?? null
    const enabled = !loading && !!resolvedUserId

    return useQuery({
        queryKey: completedVideoIdsQueryKey(resolvedUserId),
        queryFn: fetchCompletedVideoIds,
        enabled,
        staleTime: 1000 * 60 * 2,
    })
}