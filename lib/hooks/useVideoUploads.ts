import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import { supabase } from '../supabase'
import type { LocalVideoUpload, VideoUploadRecord } from '../models'
import { Platform } from 'react-native'

type VideoUploadUpsert = {
    local_reference_key: string
    roadmap_id: string
    platform: string
    media_identifier: string | null
    fallback_uri: string | null
    name: string | null
    filename: string | null
    original_filename: string | null
    content_hash: string | null
    duration_seconds: number | null
    mime_type: string | null
    file_size_bytes: number | null
    width: number | null
    height: number | null
    thumbnail_reference: string | null
    status: LocalVideoUpload['status']
}

async function fetchVideoUploads(userId: string): Promise<VideoUploadRecord[]> {
    const { data, error } = await supabase
        .from('video_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

    if (error) throw error
    // Postgres returns `bigint` columns (file_size_bytes) as strings to avoid JS number precision loss;
    // coerce back to number so downstream strict equality checks (e.g. relink metadata matching) work.
    return (data ?? []).map((record) => ({
        ...record,
        file_size_bytes: record.file_size_bytes == null ? null : Number(record.file_size_bytes),
    })) as VideoUploadRecord[]
}

function toUpsertPayload(video: LocalVideoUpload & { roadmapId: string }): VideoUploadUpsert {
    return {
        local_reference_key: video.id,
        roadmap_id: video.roadmapId,
        platform: Platform.OS,
        media_identifier: video.assetId,
        fallback_uri: video.uri,
        name: video.fileName,
        filename: video.fileName,
        original_filename: video.originalFilename ?? video.fileName,
        content_hash: video.contentHash ?? null,
        duration_seconds: video.duration,
        mime_type: video.mimeType,
        file_size_bytes: video.fileSize,
        width: video.width,
        height: video.height,
        thumbnail_reference: video.thumbnailReference,
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
        mutationFn: async (video: LocalVideoUpload & { roadmapId: string }) => {
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
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoSegmentCounts(user?.id) })
        },
    })
}

export function useDeleteVideoUpload() {
    const { user } = useAuth()

    return useMutation({
        mutationFn: async (videoUploadId: string) => {
            const userId = requireUserId(undefined, user?.id)
            const { error } = await supabase
                .from('video_uploads')
                .delete()
                .eq('id', videoUploadId)
                .eq('user_id', userId)

            if (error) throw error
            return videoUploadId
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
        },
    })
}
