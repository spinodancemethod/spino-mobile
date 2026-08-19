import type { VideoUploadRecord } from './models'

export type VideoAssetResolution =
    | { status: 'AVAILABLE'; uri: string }
    | { status: 'NEEDS_RELINK'; uri: null }

export type LocalFileInfo = {
    exists: boolean
}

export type LocalFileInfoProvider = (uri: string) => Promise<LocalFileInfo>

export async function resolveVideoAsset(
    videoUpload: Pick<VideoUploadRecord, 'fallback_uri'>,
    getFileInfo: LocalFileInfoProvider,
): Promise<VideoAssetResolution> {
    const uri = videoUpload.fallback_uri?.trim()
    if (!uri) return { status: 'NEEDS_RELINK', uri: null }

    try {
        const info = await getFileInfo(uri)
        return info.exists
            ? { status: 'AVAILABLE', uri }
            : { status: 'NEEDS_RELINK', uri: null }
    } catch {
        return { status: 'NEEDS_RELINK', uri: null }
    }
}

export async function resolveStoredVideoAsset(videoUpload: Pick<VideoUploadRecord, 'fallback_uri'>): Promise<VideoAssetResolution> {
    const FileSystem = await import('expo-file-system/legacy')
    return resolveVideoAsset(videoUpload, (uri) => FileSystem.getInfoAsync(uri))
}