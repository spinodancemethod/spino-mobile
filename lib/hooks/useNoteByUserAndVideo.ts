import { QueryFunctionContext, useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from 'lib/auth'
import { queryKeys } from 'lib/queryKeys'
import { resolveUserId } from './userId'

/**
 * useNoteByUserAndVideo
 * - Returns a single note row for the given user and video.
 * - If userId is not provided, resolves current user via auth context.
 * - queryKey: ['note', userIdOrCurrent, videoId]
 */
type NoteQueryKey = ReturnType<typeof queryKeys.note>

async function fetchNote({ queryKey }: QueryFunctionContext<NoteQueryKey>) {
    const [_key, userId, videoId] = queryKey

    const actualUserId: string | null = userId ?? null

    if (!actualUserId || !videoId) return null

    const { data, error } = await supabase
        .from('notes')
        .select('user_id, video_id, note_text, created_at, updated_at')
        .eq('user_id', actualUserId)
        .eq('video_id', videoId)
        .maybeSingle()

    if (error) throw error
    return data ?? null
}

export function useNoteByUserAndVideo(userId?: string | null, videoId?: string | null) {
    const { user, loading } = useAuth()
    const resolvedUserId = resolveUserId(userId, user?.id)
    const enabled = !loading && !!resolvedUserId && !!videoId

    return useQuery({
        queryKey: queryKeys.note(resolvedUserId, videoId),
        queryFn: fetchNote,
        enabled,
        staleTime: 1000 * 60 * 2,
    })
}
