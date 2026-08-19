import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../auth'
import type { VideoUploadRecord } from '../models'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { supabase } from '../supabase'
import { calculateVideoContentHash } from '../videoHash'
import { createVideoRelinkUpdate } from '../videoRelink'
import { type VideoRelinkCandidate, verifyVideoRelinkCandidate } from '../videoRelinkVerification'
import { requireUserId } from './userId'

export type RelinkVideoUploadInput = {
    videoUpload: VideoUploadRecord
    candidate: VideoRelinkCandidate & { assetId: string | null }
}

export function useRelinkVideoUpload() {
    const { user } = useAuth()

    return useMutation({
        mutationFn: async ({ videoUpload, candidate }: RelinkVideoUploadInput) => {
            const verification = await verifyVideoRelinkCandidate(videoUpload, candidate, calculateVideoContentHash)
            if (!verification.matches) {
                const filename = videoUpload.original_filename ?? videoUpload.filename ?? videoUpload.name ?? 'the original video'
                throw new Error(`This video does not match ${filename}. Please select the original video.`)
            }

            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase
                .from('video_uploads')
                .update(createVideoRelinkUpdate(candidate))
                .eq('id', videoUpload.id)
                .eq('user_id', userId)
                .select()
                .single()

            if (error) throw error
            return data as VideoUploadRecord
        },
        onSuccess: (videoUpload) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUpload(videoUpload.id, user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoAsset(videoUpload.id, videoUpload.fallback_uri) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments(user?.id, videoUpload.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        },
    })
}