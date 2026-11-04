import type { LocalFileInfo } from './videoAssetResolver'

/**
 * Durable storage for picked local videos.
 *
 * ImagePicker returns a copy of the chosen video inside the app *cache*
 * directory. The OS purges that directory under storage pressure and iOS
 * changes the whole container path on every app update, so a stored absolute
 * cache path stops working on the same device within days. This module keeps
 * the stored reference stable in two ways:
 *
 * 1. The media-library asset id (`media_identifier`) is preferred and resolved
 *    at runtime via expo-media-library (see videoAssetResolver).
 * 2. When no asset id is available (Android photo picker, limited iOS access)
 *    the file is copied once into the *documents* directory, which is never
 *    purged, and stored with the portable `appdocs://` scheme so the current
 *    container path is substituted on read.
 */
export const APP_DOCUMENTS_SCHEME = 'appdocs://'
const VIDEO_FOLDER = 'local-videos/'
const THUMBNAIL_FOLDER = 'thumbnails/'

export function isPortableDocumentUri(uri: string | null | undefined): boolean {
    return !!uri && uri.startsWith(APP_DOCUMENTS_SCHEME)
}

/** Convert an absolute file path under the documents directory to the portable form. Other URIs pass through. */
export function toPortableUri(uri: string, documentDirectory: string | null): string {
    if (!documentDirectory || isPortableDocumentUri(uri)) return uri
    return uri.startsWith(documentDirectory)
        ? `${APP_DOCUMENTS_SCHEME}${uri.slice(documentDirectory.length)}`
        : uri
}

/** Convert a stored portable URI back to the absolute path for the current app container. */
export function toRuntimeUri(uri: string, documentDirectory: string | null): string {
    if (!isPortableDocumentUri(uri)) return uri
    if (!documentDirectory) return uri
    return `${documentDirectory}${uri.slice(APP_DOCUMENTS_SCHEME.length)}`
}

function fileExtension(fileName: string | null | undefined, fallbackUri: string): string {
    const source = fileName ?? fallbackUri
    const match = /\.([a-zA-Z0-9]{1,5})(?:\?.*)?$/.exec(source)
    return match ? `.${match[1].toLowerCase()}` : '.mp4'
}

export type PersistPickedVideoInput = {
    uri: string
    assetId: string | null
    fileName: string | null
    /** Stable key used for the copied file name; defaults to a timestamp. */
    key?: string
}

export type PersistedVideo = {
    /** Absolute URI usable right now for playback, hashing and thumbnails. */
    runtimeUri: string
}

type FileSystemLike = {
    documentDirectory: string | null
    getInfoAsync(uri: string): Promise<LocalFileInfo>
    makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>
    copyAsync(options: { from: string; to: string }): Promise<void>
    deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>
}

async function loadFileSystem(): Promise<FileSystemLike> {
    return (await import('expo-file-system/legacy')) as unknown as FileSystemLike
}

/**
 * Make a picked video durable. With an asset id nothing is copied: the media
 * library is the source of truth and the picker's cache copy is only kept as a
 * secondary reference. Without an asset id the file is copied into documents.
 */
export async function persistPickedVideo(input: PersistPickedVideoInput, fs?: FileSystemLike): Promise<PersistedVideo> {
    if (input.assetId) return { runtimeUri: input.uri }

    const FileSystem = fs ?? await loadFileSystem()
    if (!FileSystem.documentDirectory) return { runtimeUri: input.uri }

    const folder = `${FileSystem.documentDirectory}${VIDEO_FOLDER}`
    const folderInfo = await FileSystem.getInfoAsync(folder)
    if (!folderInfo.exists) await FileSystem.makeDirectoryAsync(folder, { intermediates: true })

    const key = (input.key ?? `${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    const target = `${folder}${key}${fileExtension(input.fileName, input.uri)}`
    await FileSystem.copyAsync({ from: input.uri, to: target })
    return { runtimeUri: target }
}

/**
 * expo-video-thumbnails writes into the cache directory, which iOS purges and whose
 * absolute path changes on every app update. Copy a generated thumbnail into documents
 * and return the portable `appdocs://` form to store in the database. Falls back to the
 * original URI if anything fails so thumbnail generation never blocks a save.
 */
export async function persistThumbnail(cacheUri: string, fs?: FileSystemLike): Promise<string> {
    try {
        const FileSystem = fs ?? await loadFileSystem()
        if (!FileSystem.documentDirectory) return cacheUri
        const folder = `${FileSystem.documentDirectory}${THUMBNAIL_FOLDER}`
        const folderInfo = await FileSystem.getInfoAsync(folder)
        if (!folderInfo.exists) await FileSystem.makeDirectoryAsync(folder, { intermediates: true })
        const extension = /\.(jpe?g|png|webp)$/i.exec(cacheUri)?.[0]?.toLowerCase() ?? '.jpg'
        const target = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
        await FileSystem.copyAsync({ from: cacheUri, to: target })
        return toPortableUri(target, FileSystem.documentDirectory)
    } catch {
        return cacheUri
    }
}

/** Delete a documents copy we made earlier. Cache and media-library references are left alone. */
export async function removePersistedVideo(storedUri: string | null | undefined, fs?: FileSystemLike): Promise<void> {
    if (!isPortableDocumentUri(storedUri)) return
    const FileSystem = fs ?? await loadFileSystem()
    try {
        await FileSystem.deleteAsync(toRuntimeUri(storedUri!, FileSystem.documentDirectory), { idempotent: true })
    } catch {
        // Best effort: a missing copy is not an error.
    }
}
