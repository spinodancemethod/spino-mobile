import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from 'lib/auth'

/**
 * useNoteByUserAndVideo
 * - Returns a single note row for the given user and video.
 * - If userId is not provided, resolves current user via supabase.auth.getUser().
 * - queryKey: ['note', userIdOrCurrent, videoId]
 */
async function fetchNote({ queryKey }: any) {
    const [_key, userId, videoId] = queryKey

    let actualUserId: string | null = userId ?? null
    if (!actualUserId) {
        const { data: ud, error: ue } = await supabase.auth.getUser()
        if (ue) throw ue
        actualUserId = ud?.user?.id ?? null
    }

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
    const resolvedUserId = userId ?? user?.id ?? null
    const enabled = !loading && !!resolvedUserId && !!videoId

    return useQuery({
        queryKey: ['note', resolvedUserId, videoId ?? null],
        queryFn: fetchNote,
        enabled,
        staleTime: 1000 * 60 * 2,
    })
}
