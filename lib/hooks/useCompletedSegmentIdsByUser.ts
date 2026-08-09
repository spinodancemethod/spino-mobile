import { QueryFunctionContext, useQuery } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { queryKeys } from 'lib/queryKeys'
import { supabase } from '../supabase'
import { resolveUserId } from './userId'

type SegmentIdRow = {
    segment_id: string
}

export function completedSegmentIdsQueryKey(userId?: string | null) {
    return queryKeys.completedSegmentIds(userId)
}

type CompletedSegmentIdsQueryKey = ReturnType<typeof completedSegmentIdsQueryKey>

async function fetchCompletedSegmentIds({ queryKey }: QueryFunctionContext<CompletedSegmentIdsQueryKey>): Promise<string[]> {
    const [_key, userId] = queryKey
    const actualUserId = userId ?? null
    if (!actualUserId) return []

    const { data, error } = await supabase
        .from('user_segment_progress')
        .select('segment_id')
        .eq('user_id', actualUserId)
        .eq('status', 'completed')

    if (error) throw error
    return ((data || []) as SegmentIdRow[]).map((row) => row.segment_id)
}

export function useCompletedSegmentIdsByUser(userId?: string | null) {
    const { user, loading } = useAuth()
    const resolvedUserId = resolveUserId(userId, user?.id)
    const enabled = !loading && !!resolvedUserId

    return useQuery({
        queryKey: completedSegmentIdsQueryKey(resolvedUserId),
        queryFn: fetchCompletedSegmentIds,
        enabled,
        staleTime: 1000 * 60 * 2,
    })
}
