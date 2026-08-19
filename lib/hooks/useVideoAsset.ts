import { useQuery } from '@tanstack/react-query'
import type { VideoUploadRecord } from '../models'
import { queryKeys } from '../queryKeys'
import { resolveStoredVideoAsset } from '../videoAssetResolver'

export function useVideoAsset(videoUpload: VideoUploadRecord | null | undefined) {
    return useQuery({
        queryKey: queryKeys.videoAsset(videoUpload?.id, videoUpload?.fallback_uri),
        queryFn: () => resolveStoredVideoAsset(videoUpload!),
        enabled: !!videoUpload?.id,
    })
}