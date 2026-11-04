import { useMutation } from '@tanstack/react-query'
import type { VideoUploadRecord } from '../models'
import { calculateVideoContentHash } from '../videoHash'
import { hasPotentialVideoMetadataMatch, type ScannedVideoCandidate } from '../videoLibraryScanner'
import { getVideoRelinkMetadataMismatch, verifyVideoRelinkCandidate } from '../videoRelinkVerification'
import { ensureMediaLibraryAssetAccess } from '../mediaLibraryAccess'

const ASSETS_PER_PAGE = 100
const MAX_SCANNED_ASSETS = 1000

/**
 * Counters for each stage of the scan. Every stage silently discards assets, so
 * without these a "no matches" result is impossible to debug on a release build.
 */
export type VideoRelinkScanDiagnostics = {
    inspected: number
    durationPrefilterRejected: number
    inaccessible: number
    sizePrefilterRejected: number
    candidates: number
    hashMismatch: number
    hashUnavailable: number
    hashErrors: number
}

type ScanResult = { candidates: ScannedVideoCandidate[]; diagnostics: VideoRelinkScanDiagnostics }

async function scanVideoCandidates(uploads: VideoUploadRecord[]): Promise<ScanResult> {
    // SDK 58 moved the classic MediaLibrary API (getAssetsAsync, MediaType, SortBy)
    // behind the /legacy subpath; the root import now exposes the new "next" API.
    const MediaLibrary = await import('expo-media-library/legacy')
    const { File } = await import('expo-file-system')
    if (!await ensureMediaLibraryAssetAccess()) throw new Error('Video library permission is required to find recovered videos.')

    const diagnostics: VideoRelinkScanDiagnostics = {
        inspected: 0, durationPrefilterRejected: 0, inaccessible: 0, sizePrefilterRejected: 0,
        candidates: 0, hashMismatch: 0, hashUnavailable: 0, hashErrors: 0,
    }
    const candidates: ScannedVideoCandidate[] = []
    let after: string | undefined
    let hasNextPage = true
    while (hasNextPage && diagnostics.inspected < MAX_SCANNED_ASSETS) {
        const page = await MediaLibrary.getAssetsAsync({
            first: ASSETS_PER_PAGE,
            after,
            mediaType: MediaLibrary.MediaType.video,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
        })
        for (const asset of page.assets) {
            if (diagnostics.inspected >= MAX_SCANNED_ASSETS) break
            diagnostics.inspected += 1
            if (!hasPotentialVideoMetadataMatch({ fileSize: null, durationSeconds: asset.duration }, uploads)) {
                diagnostics.durationPrefilterRejected += 1
                continue
            }
            try {
                const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false })
                const uri = info.localUri ?? asset.uri
                const file = new File(uri)
                if (!file.exists) {
                    diagnostics.inaccessible += 1
                    continue
                }
                const candidate = {
                    assetId: asset.id,
                    filename: asset.filename,
                    uri,
                    fileSize: file.size,
                    durationSeconds: asset.duration,
                }
                if (hasPotentialVideoMetadataMatch(candidate, uploads)) {
                    candidates.push(candidate)
                } else {
                    diagnostics.sizePrefilterRejected += 1
                }
            } catch {
                // Inaccessible and cloud-only assets are not recovery candidates.
                diagnostics.inaccessible += 1
            }
        }
        after = page.endCursor ?? undefined
        hasNextPage = page.hasNextPage
    }
    diagnostics.candidates = candidates.length
    return { candidates, diagnostics }
}

export type VideoRelinkRecommendations = {
    byUploadId: Record<string, ScannedVideoCandidate[]>
    matchCount: number
    diagnostics: VideoRelinkScanDiagnostics
}

export function describeRelinkScan(d: VideoRelinkScanDiagnostics): string {
    return `Scanned ${d.inspected} device videos: ${d.durationPrefilterRejected} wrong duration, `
        + `${d.inaccessible} unreadable, ${d.sizePrefilterRejected} wrong size, ${d.candidates} candidates, `
        + `${d.hashMismatch} hash mismatch, ${d.hashUnavailable} no stored hash, ${d.hashErrors} hash errors.`
}

export function useVideoRelinkRecommendations() {
    return useMutation({
        mutationFn: async (uploads: VideoUploadRecord[]): Promise<VideoRelinkRecommendations> => {
            const eligibleUploads = uploads.filter((upload) => !!upload.content_hash)
            const { candidates, diagnostics } = await scanVideoCandidates(eligibleUploads)
            diagnostics.hashUnavailable = uploads.length - eligibleUploads.length
            const byUploadId: Record<string, ScannedVideoCandidate[]> = {}
            let matchCount = 0
            for (const upload of eligibleUploads) {
                const matches: ScannedVideoCandidate[] = []
                for (const candidate of candidates) {
                    if (getVideoRelinkMetadataMismatch(upload, candidate) != null) continue
                    const verification = await verifyVideoRelinkCandidate(upload, candidate, calculateVideoContentHash)
                    if (verification.matches) {
                        matches.push(candidate)
                    } else if (verification.reason === 'HASH_MISMATCH') {
                        diagnostics.hashMismatch += 1
                    } else if (verification.reason === 'CANDIDATE_UNAVAILABLE') {
                        diagnostics.hashErrors += 1
                    }
                }
                matches.sort((left, right) => left.uri.localeCompare(right.uri))
                byUploadId[upload.id] = matches
                matchCount += matches.length
            }
            return { byUploadId, matchCount, diagnostics }
        },
    })
}
