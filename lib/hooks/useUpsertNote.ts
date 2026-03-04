import { useMutation } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { queryClient } from '../queryClient'

/**
 * useUpsertNote
 * - Performs an upsert on the `notes` table using (user_id, video_id) composite key.
 * - Expects payload: { user_id, video_id, note_text }
 */
export function useUpsertNote() {
    return useMutation({
        mutationFn: async (payload: any) => {
            const { user_id, video_id, note_text } = payload || {}
            // If user_id not provided, resolve via supabase.auth.getUser()
            let actualUserId = user_id ?? null
            if (!actualUserId) {
                const { data: ud, error: ue } = await supabase.auth.getUser()
                if (ue) throw ue
                actualUserId = ud?.user?.id ?? null
            }
            if (!actualUserId) throw new Error('No authenticated user')

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
            queryClient.invalidateQueries({ queryKey: ['note', actualUserId, video_id] })
            return data
        }
    })
}
