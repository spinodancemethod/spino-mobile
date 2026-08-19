import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import type { VideoUploadRecord } from '../models'
import { queryKeys } from '../queryKeys'
import { resolveStoredVideoAsset, type VideoAssetResolution } from '../videoAssetResolver'

function createVideoReferences(records: VideoUploadRecord[]): string {
    return records
        .map((record) => `${record.id}:${record.fallback_uri ?? ''}`)
        .sort()
        .join('|')
}

async function resolveVideoAssetAvailability(records: VideoUploadRecord[]): Promise<Record<string, VideoAssetResolution>> {
    const entries = await Promise.all(records.map(async (record) => [
        record.id,
        await resolveStoredVideoAsset(record),
    ] as const))
    return Object.fromEntries(entries)
}

export function useVideoAssetAvailability(records: VideoUploadRecord[]) {
    const { user, loading } = useAuth()
    const references = createVideoReferences(records)

    return useQuery({
        queryKey: queryKeys.videoAssetAvailability(user?.id, references),
        queryFn: () => resolveVideoAssetAvailability(records),
        enabled: !loading && !!user?.id,
    })
}