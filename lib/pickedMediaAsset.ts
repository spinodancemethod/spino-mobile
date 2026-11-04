import { getMediaLibraryAssetAccess } from './mediaLibraryAccess'

export type MediaAssetLike = {
    id: string
    filename: string
    duration: number
}

export type PickedVideoLike = {
    fileName: string | null
    durationSeconds: number | null
}

const DURATION_TOLERANCE_SECONDS = 0.5

/**
 * Find the media-library asset that corresponds to a picked video.
 *
 * The Android photo picker returns `content://media/picker/...` URIs, which
 * expo-image-picker cannot map to a MediaStore id, so `asset.assetId` is always
 * null there. Without an id the record only has the picker's cache copy, which
 * Android purges, and the resolver can never find the gallery original again.
 * Filename + duration is enough to identify the asset in practice; the content
 * hash still guards the relink flow if this ever picks a false positive.
 */
export function matchPickedMediaAsset(picked: PickedVideoLike, assets: MediaAssetLike[]): string | null {
    const wantedName = picked.fileName?.trim().toLowerCase()
    if (!wantedName) return null
    const matches = assets.filter((asset) => {
        if (asset.filename.trim().toLowerCase() !== wantedName) return false
        if (picked.durationSeconds == null) return true
        return Math.abs(asset.duration - picked.durationSeconds) <= DURATION_TOLERANCE_SECONDS
    })
    // Ambiguous names (e.g. several "VID.mp4" of the same length) are not safe to link blindly.
    return matches.length === 1 ? matches[0].id : null
}

const ASSETS_PER_PAGE = 100
const MAX_SCANNED_ASSETS = 500

/** Media-library id for a just-picked video, or null when access is denied or no unique match exists. Never throws. */
export async function lookupPickedMediaAssetId(picked: PickedVideoLike): Promise<string | null> {
    if (!picked.fileName) return null
    try {
        if (!await getMediaLibraryAssetAccess()) return null
        const MediaLibrary = await import('expo-media-library/legacy')
        const seen: MediaAssetLike[] = []
        let after: string | undefined
        let hasNextPage = true
        while (hasNextPage && seen.length < MAX_SCANNED_ASSETS) {
            const page = await MediaLibrary.getAssetsAsync({
                first: ASSETS_PER_PAGE,
                after,
                mediaType: MediaLibrary.MediaType.video,
                sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            })
            seen.push(...page.assets)
            // Stop paging as soon as the name has been seen: a unique match is decided within the page set.
            if (page.assets.some((asset) => asset.filename.toLowerCase() === picked.fileName!.trim().toLowerCase())) break
            after = page.endCursor ?? undefined
            hasNextPage = page.hasNextPage
        }
        return matchPickedMediaAsset(picked, seen)
    } catch {
        return null
    }
}
