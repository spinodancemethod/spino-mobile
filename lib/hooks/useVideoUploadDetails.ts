import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import type { VideoUploadRecord } from '../models'

export type VideoUploadNote = {
    user_id: string
    video_upload_id: string
    note_text: string | null
    created_at: string
    updated_at: string
}

export function useVideoUploadById(id?: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoUpload(id, user?.id),
        queryFn: async () => {
            const { data, error } = await supabase.from('video_uploads').select('*').eq('id', id!).eq('user_id', user!.id).single()
            if (error) throw error
            return data as VideoUploadRecord
        },
        enabled: !loading && !!user?.id && !!id,
    })
}

export function useVideoUploadNote(id?: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoUploadNote(id, user?.id),
        queryFn: async () => {
            const { data, error } = await supabase.from('video_upload_notes').select('*').eq('video_upload_id', id!).eq('user_id', user!.id).maybeSingle()
            if (error) throw error
            return (data as VideoUploadNote | null) ?? null
        },
        enabled: !loading && !!user?.id && !!id,
    })
}

export function useUpsertVideoUploadNote() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: { videoUploadId: string; noteText: string }) => {
            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase.from('video_upload_notes').upsert({
                user_id: userId,
                video_upload_id: input.videoUploadId,
                note_text: input.noteText,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,video_upload_id' }).select().single()
            if (error) throw error
            return data as VideoUploadNote
        },
        onSuccess: (note) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploadNote(note.video_upload_id, user?.id) })
        },
    })
}
