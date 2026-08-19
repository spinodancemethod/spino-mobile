import { useMutation } from '@tanstack/react-query'
import type { VideoUploadRecord } from '../models'
import { findVideoRelinkCandidates } from '../videoRelinkDiscovery'
import { calculateVideoContentHash } from '../videoHash'
import { hasPotentialVideoMetadataMatch, type ScannedVideoCandidate } from '../videoLibraryScanner'

const ASSETS_PER_PAGE = 100
const MAX_SCANNED_ASSETS = 1000

async function scanVideoCandidates(uploads: VideoUploadRecord[]): Promise<ScannedVideoCandidate[]> {
    const MediaLibrary = await import('expo-media-library')
    const { File } = await import('expo-file-system')
    const permission = await MediaLibrary.requestPermissionsAsync(false, ['video'])
    if (!permission.granted) throw new Error('Video library permission is required to find recovered videos.')

    const candidates: ScannedVideoCandidate[] = []
    let inspectedAssets = 0
    let after: string | undefined
    let hasNextPage = true
    while (hasNextPage && inspectedAssets < MAX_SCANNED_ASSETS) {
        const page = await MediaLibrary.getAssetsAsync({
            first: ASSETS_PER_PAGE,
            after,
            mediaType: MediaLibrary.MediaType.video,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
        })
        for (const asset of page.assets) {
            if (inspectedAssets >= MAX_SCANNED_ASSETS) break
            inspectedAssets += 1
            if (!hasPotentialVideoMetadataMatch({ fileSize: null, durationSeconds: asset.duration }, uploads)) continue
            try {
                const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false })
                const uri = info.localUri ?? asset.uri
                const file = new File(uri)
                if (!file.exists) continue
                const candidate = {
                    assetId: asset.id,
                    filename: asset.filename,
                    uri,
                    fileSize: file.size,
                    durationSeconds: asset.duration,
                }
                if (hasPotentialVideoMetadataMatch(candidate, uploads)) candidates.push(candidate)
            } catch {
                // Inaccessible and cloud-only assets are not recovery candidates.
            }
        }
        after = page.endCursor ?? undefined
        hasNextPage = page.hasNextPage
    }
    return candidates
}

export type VideoRelinkRecommendations = Record<string, ScannedVideoCandidate[]>

export function useVideoRelinkRecommendations() {
    return useMutation({
        mutationFn: async (uploads: VideoUploadRecord[]): Promise<VideoRelinkRecommendations> => {
            const eligibleUploads = uploads.filter((upload) => !!upload.content_hash)
            const candidates = await scanVideoCandidates(eligibleUploads)
            const entries = await Promise.all(eligibleUploads.map(async (upload) => {
                const verifiedCandidates = await findVideoRelinkCandidates(upload, candidates, calculateVideoContentHash)
                const recommendations = verifiedCandidates.flatMap((candidate) => {
                    const scannedCandidate = candidates.find((item) => item.uri === candidate.uri)
                    return scannedCandidate ? [scannedCandidate] : []
                })
                return [upload.id, recommendations] as const
            }))
            return Object.fromEntries(entries)
        },
    })
}