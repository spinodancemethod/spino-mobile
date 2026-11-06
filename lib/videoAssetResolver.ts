import type { VideoUploadRecord } from './models'
import { toRuntimeUri } from './localVideoStore'
import { getMediaLibraryAssetAccess } from './mediaLibraryAccess'

export type VideoAssetResolution =
    | { status: 'AVAILABLE'; uri: string }
    | { status: 'NEEDS_RELINK'; uri: null }

export type LocalFileInfo = {
    exists: boolean
}

export type LocalFileInfoProvider = (uri: string) => Promise<LocalFileInfo>

export type VideoAssetResolverDeps = {
    getFileInfo: LocalFileInfoProvider
    /** Current local file URI for a media-library asset id, or null when unknown/unavailable. */
    getAssetLocalUri?: (assetId: string) => Promise<string | null>
    documentDirectory?: string | null
}

type ResolvableRecord = Pick<VideoUploadRecord, 'fallback_uri' | 'media_identifier'>

async function isAccessible(uri: string, getFileInfo: LocalFileInfoProvider): Promise<boolean> {
    try {
        return (await getFileInfo(uri)).exists
    } catch {
        return false
    }
}

/**
 * Resolution order:
 * 1. media-library asset id → current local URI (survives cache purges and app updates)
 * 2. stored path (portable `appdocs://` documents copy, or a legacy absolute path)
 * 3. NEEDS_RELINK
 * Nothing here throws; every failure is reported as NEEDS_RELINK.
 */
export async function resolveVideoAsset(
    videoUpload: ResolvableRecord,
    deps: LocalFileInfoProvider | VideoAssetResolverDeps,
): Promise<VideoAssetResolution> {
    const { getFileInfo, getAssetLocalUri, documentDirectory = null } =
        typeof deps === 'function' ? { getFileInfo: deps } as VideoAssetResolverDeps : deps

    const assetId = videoUpload.media_identifier?.trim()
    if (assetId && getAssetLocalUri) {
        try {
            const assetUri = await getAssetLocalUri(assetId)
            if (assetUri && await isAccessible(assetUri, getFileInfo)) return { status: 'AVAILABLE', uri: assetUri }
        } catch {
            // Fall through to the stored path.
        }
    }

    const stored = videoUpload.fallback_uri?.trim()
    if (stored) {
        const uri = toRuntimeUri(stored, documentDirectory)
        if (await isAccessible(uri, getFileInfo)) return { status: 'AVAILABLE', uri }
    }

    return { status: 'NEEDS_RELINK', uri: null }
}

async function getMediaLibraryAssetUri(assetId: string): Promise<string | null> {
    if (!await getMediaLibraryAssetAccess()) return null
    const MediaLibrary = await import('expo-media-library/legacy')
    const info = await MediaLibrary.getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: false })
    return info?.localUri ?? info?.uri ?? null
}

export async function resolveStoredVideoAsset(videoUpload: ResolvableRecord): Promise<VideoAssetResolution> {
    const FileSystem = await import('expo-file-system/legacy')
    return resolveVideoAsset(videoUpload, {
        getFileInfo: (uri) => FileSystem.getInfoAsync(uri),
        getAssetLocalUri: getMediaLibraryAssetUri,
        documentDirectory: FileSystem.documentDirectory,
    })
}
