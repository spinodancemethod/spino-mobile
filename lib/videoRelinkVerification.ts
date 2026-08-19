import type { VideoUploadRecord } from './models'

const DURATION_TOLERANCE_SECONDS = 0.5

export type VideoRelinkCandidate = {
    uri: string
    fileSize: number | null
    durationSeconds: number | null
}

export type VideoRelinkVerification =
    | { matches: true }
    | { matches: false; reason: 'CANDIDATE_UNAVAILABLE' | 'FILE_SIZE_MISMATCH' | 'DURATION_MISMATCH' | 'HASH_UNAVAILABLE' | 'HASH_MISMATCH' }

export type ContentHashCalculator = (uri: string) => Promise<string>

export function getVideoRelinkMetadataMismatch(
    videoUpload: Pick<VideoUploadRecord, 'file_size_bytes' | 'duration_seconds'>,
    candidate: Pick<VideoRelinkCandidate, 'fileSize' | 'durationSeconds'>,
): 'FILE_SIZE_MISMATCH' | 'DURATION_MISMATCH' | null {
    if (
        videoUpload.file_size_bytes != null
        && candidate.fileSize != null
        && videoUpload.file_size_bytes !== candidate.fileSize
    ) {
        return 'FILE_SIZE_MISMATCH'
    }

    if (
        videoUpload.duration_seconds != null
        && candidate.durationSeconds != null
        && Math.abs(videoUpload.duration_seconds - candidate.durationSeconds) > DURATION_TOLERANCE_SECONDS
    ) {
        return 'DURATION_MISMATCH'
    }

    return null
}

export async function verifyVideoRelinkCandidate(
    videoUpload: Pick<VideoUploadRecord, 'content_hash' | 'file_size_bytes' | 'duration_seconds'>,
    candidate: VideoRelinkCandidate,
    calculateHash: ContentHashCalculator,
): Promise<VideoRelinkVerification> {
    if (!candidate.uri.trim()) return { matches: false, reason: 'CANDIDATE_UNAVAILABLE' }

    const metadataMismatch = getVideoRelinkMetadataMismatch(videoUpload, candidate)
    if (metadataMismatch) return { matches: false, reason: metadataMismatch }

    if (!videoUpload.content_hash) return { matches: false, reason: 'HASH_UNAVAILABLE' }

    try {
        const candidateHash = await calculateHash(candidate.uri)
        return candidateHash === videoUpload.content_hash
            ? { matches: true }
            : { matches: false, reason: 'HASH_MISMATCH' }
    } catch {
        return { matches: false, reason: 'CANDIDATE_UNAVAILABLE' }
    }
}