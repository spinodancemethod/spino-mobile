import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import { supabase } from '../supabase'
import type { VideoUploadRecord } from '../models'
import type { LocalVideoUpload } from '../localVideoStore'
import { Platform } from 'react-native'

type VideoUploadUpsert = {
    local_reference_key: string
    platform: string
    media_identifier: string | null
    fallback_uri: string | null
    name: string | null
    filename: string | null
    duration_seconds: number | null
    mime_type: string | null
    file_size_bytes: number | null
    width: number | null
    height: number | null
    status: LocalVideoUpload['status']
}

async function fetchVideoUploads(userId: string): Promise<VideoUploadRecord[]> {
    const { data, error } = await supabase
        .from('video_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as VideoUploadRecord[]
}

function toUpsertPayload(video: LocalVideoUpload): VideoUploadUpsert {
    return {
        local_reference_key: video.id,
        platform: Platform.OS,
        media_identifier: video.assetId,
        fallback_uri: video.uri,
        name: video.fileName,
        filename: video.fileName,
        duration_seconds: video.duration,
        mime_type: video.mimeType,
        file_size_bytes: video.fileSize,
        width: video.width,
        height: video.height,
        status: video.status,
    }
}

export function useVideoUploads() {
    const { user, loading } = useAuth()
    const userId = user?.id ?? null

    return useQuery({
        queryKey: queryKeys.videoUploads(userId),
        queryFn: () => fetchVideoUploads(userId!),
        enabled: !loading && !!userId,
    })
}

export function useSyncVideoUpload() {
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (video: LocalVideoUpload) => {
            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase
                .from('video_uploads')
                .upsert(
                    {
                        user_id: userId,
                        ...toUpsertPayload(video),
                    },
                    { onConflict: 'user_id,local_reference_key' },
                )
                .select()
                .single()

            if (error) throw error
            return data as VideoUploadRecord
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
        },
    })
}
