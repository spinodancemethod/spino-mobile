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
 * Returns a local file:// URI for the given remote video URL.
 * Downloads to device cache on first call; returns cached path immediately on
 * subsequent calls with zero egress.
 */
export function useVideoSource(remoteUrl: string | null) {
    const [localUri, setLocalUri] = useState<string | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)

    useEffect(() => {
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
                if (!cancelled) setLocalUri(localPath)
                return
            }

            if (!cancelled) setIsDownloading(true)
            try {
                const result = await FileSystem.downloadAsync(remoteUrl!, localPath)
                if (!cancelled) setLocalUri(result.uri)
            } catch (e) {
                console.warn('[useVideoSource] cache download failed, falling back to remote', e)
                if (!cancelled) setLocalUri(remoteUrl!)
            } finally {
                if (!cancelled) setIsDownloading(false)
            }
        }

        resolve()
        return () => { cancelled = true }
    }, [remoteUrl])

    return { localUri, isDownloading }
}
