import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

function cacheFilename(remoteUrl: string): string {
    try {
        const url = new URL(remoteUrl)
        const segments = url.pathname.split('/').filter(Boolean)
        const key = segments.slice(-2).join('_')
        return key || segments[segments.length - 1] || 'video.mp4'
    } catch {
        return 'video.mp4'
    }
}

/**
 * Returns a URI for the given remote video URL.
 * Immediately returns the remote URL so playback starts right away, then
 * downloads to device cache in the background. On subsequent calls with the
 * same URL the cached local path is returned instantly with zero egress.
 */
export function useVideoSource(remoteUrl: string | null) {
    // Start with the remote URL immediately so the player doesn't wait for download
    const [localUri, setLocalUri] = useState<string | null>(remoteUrl)
    const [isDownloading, setIsDownloading] = useState(false)

    useEffect(() => {
        // Always update to the latest remoteUrl (covers source changes)
        setLocalUri(remoteUrl)

        if (!remoteUrl) return

        // Web has no filesystem access — stream directly with no caching
        if (Platform.OS === 'web') return

        let cancelled = false

        async function resolve() {
            const cacheDir = FileSystem.cacheDirectory + 'videos/'
            const dirInfo = await FileSystem.getInfoAsync(cacheDir)
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
            }

            const filename = cacheFilename(remoteUrl!)
            const localPath = cacheDir + filename
            const fileInfo = await FileSystem.getInfoAsync(localPath)

            if (fileInfo.exists) {
                // Cached — upgrade from remote to local URI
                if (!cancelled) setLocalUri(localPath)
                return
            }

            // Download in background; player is already streaming from remoteUrl
            if (!cancelled) setIsDownloading(true)
            try {
                const result = await FileSystem.downloadAsync(remoteUrl!, localPath)
                if (!cancelled) setLocalUri(result.uri)
            } catch (e) {
                console.warn('[useVideoSource] background cache download failed', e)
                // Player continues streaming from remoteUrl — no action needed
            } finally {
                if (!cancelled) setIsDownloading(false)
            }
        }

        resolve()
        return () => { cancelled = true }
    }, [remoteUrl])

    return { localUri, isDownloading }
}
