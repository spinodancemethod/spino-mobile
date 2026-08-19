import type { VideoUploadRecord } from './models'
import {
    getVideoRelinkMetadataMismatch,
    type ContentHashCalculator,
    type VideoRelinkCandidate,
    verifyVideoRelinkCandidate,
} from './videoRelinkVerification'

export async function findVideoRelinkCandidates(
    videoUpload: Pick<VideoUploadRecord, 'content_hash' | 'file_size_bytes' | 'duration_seconds'>,
    candidates: VideoRelinkCandidate[],
    calculateHash: ContentHashCalculator,
): Promise<VideoRelinkCandidate[]> {
    if (!videoUpload.content_hash) return []

    const metadataMatches = candidates.filter((candidate) => (
        candidate.uri.trim().length > 0
        && getVideoRelinkMetadataMismatch(videoUpload, candidate) == null
    ))
    const verified = await Promise.all(metadataMatches.map(async (candidate) => ({
        candidate,
        verification: await verifyVideoRelinkCandidate(videoUpload, candidate, calculateHash),
    })))

    return verified
        .filter(({ verification }) => verification.matches)
        .map(({ candidate }) => candidate)
        .sort((left, right) => left.uri.localeCompare(right.uri))
}