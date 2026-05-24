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
 * Returns a URI for the given remote video URL, preferring a locally cached
 * copy to eliminate egress on repeat views.
 *
 * Starts as `null` (pending), then resolves to:
 *   - the local file path immediately if the video is already cached, or
 *   - the remote URL while a background download runs.
 *
 * Because the source is determined before the player mounts, it never needs
 * to switch mid-stream (which would reset playback to 0:00).
 *
 * Web: no filesystem access — always resolves to the remote URL.
 */
export function useVideoSource(remoteUrl: string | null) {
    const [localUri, setLocalUri] = useState<string | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)

    useEffect(() => {
        // Reset on source change so the player doesn't flash stale content
        setLocalUri(null)

        if (!remoteUrl) return

        // Web has no filesystem access — stream directly with no caching
        if (Platform.OS === 'web') {
            setLocalUri(remoteUrl)
            return
        }

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
                // Already cached — play locally with zero egress
                if (!cancelled) setLocalUri(localPath)
                return
            }

            // Not cached yet — stream from remote while downloading in background
            if (!cancelled) {
                setLocalUri(remoteUrl!)
                setIsDownloading(true)
            }
            try {
                const result = await FileSystem.downloadAsync(remoteUrl!, localPath)
                // Update to local URI once download completes (next visit uses cache)
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
