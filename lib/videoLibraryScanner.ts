import type { VideoRelinkCandidate } from './videoRelinkVerification'

export type ScannedVideoCandidate = VideoRelinkCandidate & {
    assetId: string
    filename: string
}

export function hasPotentialVideoMetadataMatch(
    candidate: Pick<VideoRelinkCandidate, 'fileSize' | 'durationSeconds'>,
    uploads: Array<{ file_size_bytes?: number | null; duration_seconds?: number | null }>,
): boolean {
    return uploads.some((upload) => {
        const sizeMatches = upload.file_size_bytes == null || candidate.fileSize == null || upload.file_size_bytes === candidate.fileSize
        const durationMatches = upload.duration_seconds == null
            || candidate.durationSeconds == null
            || Math.abs(upload.duration_seconds - candidate.durationSeconds) <= 0.5
        return sizeMatches && durationMatches
    })
}