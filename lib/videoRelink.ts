import type { VideoUploadRecord } from './models'

export function createVideoRelinkUpdate(candidate: {
    uri: string
    assetId: string | null
}) {
    return {
        fallback_uri: candidate.uri,
        media_identifier: candidate.assetId,
        status: 'AVAILABLE' as const,
        updated_at: new Date().toISOString(),
    }
}

export function preservesVideoUploadIdentity(
    before: Pick<VideoUploadRecord, 'id'>,
    after: Pick<VideoUploadRecord, 'id'>,
): boolean {
    return before.id === after.id
}