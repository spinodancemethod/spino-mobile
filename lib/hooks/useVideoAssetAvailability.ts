import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useAuth } from '../auth'
import type { VideoUploadRecord } from '../models'
import { queryKeys } from '../queryKeys'
import { resolveStoredVideoAsset, type VideoAssetResolution } from '../videoAssetResolver'

/**
 * Resolves each stored video reference to a playable local URI.
 *
 * One query per record (sharing the `videoAsset` key with useVideoAsset) so tiles flip to
 * AVAILABLE as soon as *their* file is found instead of waiting for the slowest one, and a
 * runtime URI change for one video re-resolves only that video.
 */
export function useVideoAssetAvailability(records: VideoUploadRecord[]) {
    const { user, loading } = useAuth()
    const enabled = !loading && !!user?.id

    const results = useQueries({
        queries: records.map((record) => ({
            queryKey: queryKeys.videoAsset(record.id, `${record.media_identifier ?? ''}|${record.fallback_uri ?? ''}`),
            queryFn: () => resolveStoredVideoAsset(record),
            enabled,
        })),
    })

    // useMemo deps must have a constant length, so we can't spread one entry per query.
    // Collapse the per-query data identities into a single string key instead:
    // dataUpdatedAt changes whenever a query's data changes, which is what we care about.
    const dataVersion = results.map((result) => result.dataUpdatedAt).join(',')

    const data = useMemo(() => {
        const map: Record<string, VideoAssetResolution> = {}
        records.forEach((record, index) => {
            const resolution = results[index]?.data
            if (resolution) map[record.id] = resolution
        })
        return map
        // results is a new array each render; dataVersion tracks the per-query data changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records, dataVersion])

    return {
        data,
        isLoading: results.some((result) => result.isLoading),
        isError: results.some((result) => result.isError),
    }
}
