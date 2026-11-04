type PermissionLike = { granted: boolean; canAskAgain?: boolean }

type MediaLibraryLike = {
    getPermissionsAsync(writeOnly?: boolean, granular?: string[]): Promise<PermissionLike>
    requestPermissionsAsync(writeOnly?: boolean, granular?: string[]): Promise<PermissionLike>
}

async function loadMediaLibrary(): Promise<MediaLibraryLike> {
    return (await import('expo-media-library/legacy')) as unknown as MediaLibraryLike
}

/**
 * Granular (`['video']`) permissions only exist on Android 13+ and the native
 * call is rejected outright in some hosts (notably Expo Go, whose manifest is
 * not ours). Try the granular form first and fall back to the plain one.
 */
async function withGranularFallback(call: (granular?: string[]) => Promise<PermissionLike>): Promise<PermissionLike> {
    try {
        return await call(['video'])
    } catch {
        return call()
    }
}

/** Read-only media-library permission state. Never throws. */
export async function getMediaLibraryAssetAccess(): Promise<boolean> {
    try {
        const MediaLibrary = await loadMediaLibrary()
        const status = await withGranularFallback((granular) => MediaLibrary.getPermissionsAsync(false, granular))
        return status.granted
    } catch {
        return false
    }
}

/**
 * Ask for read-only media-library access so the image picker returns a media
 * asset id. The id is what the resolver uses to find the video again after the
 * picker's cache copy has been purged. Never throws: a refusal just means the
 * app falls back to copying the file into the documents directory.
 */
export async function ensureMediaLibraryAssetAccess(): Promise<boolean> {
    try {
        const MediaLibrary = await loadMediaLibrary()
        const current = await withGranularFallback((granular) => MediaLibrary.getPermissionsAsync(false, granular))
        if (current.granted) return true
        if (current.canAskAgain === false) return false
        const requested = await withGranularFallback((granular) => MediaLibrary.requestPermissionsAsync(false, granular))
        return requested.granted
    } catch {
        return false
    }
}
