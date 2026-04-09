import { useMutation } from '@tanstack/react-query'
import { useAuth } from 'lib/auth'
import { queryKeys } from 'lib/queryKeys'
import { supabase } from '../supabase'
import { queryClient } from '../queryClient'
import { requireUserId } from './userId'

/**
 * useUpsertNote
 * - Performs an upsert on the `notes` table using (user_id, video_id) composite key.
 * - Expects payload: { user_id, video_id, note_text }
 */
export function useUpsertNote() {
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (payload: { user_id?: string | null; video_id: string; note_text?: string | null }) => {
            const { user_id, video_id, note_text } = payload || {}
            const actualUserId = requireUserId(user_id, user?.id, 'No authenticated user')

            const row = {
                user_id: actualUserId,
                video_id,
                note_text,
            }

            // Use onConflict with a comma-separated column list (no parentheses)
            // PostgREST expects column names like 'user_id,video_id' — parentheses cause a parse error.
            const { data, error } = await supabase.from('notes').upsert(row, { onConflict: 'user_id,video_id' }).select().maybeSingle()
            if (error) throw error

            // Invalidate the note query for this user+video (react-query v4 filter form)
            queryClient.invalidateQueries({ queryKey: queryKeys.note(actualUserId, video_id) })
            return data
        }
    })
}
