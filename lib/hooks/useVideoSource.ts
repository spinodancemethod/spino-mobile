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
 * Always resolves immediately to `remoteUrl` so the player has a valid source
 * from the very first render (avoids grey screen on native builds where
 * useVideoPlayer initialises the native player at mount time).
 *
 * If the file is already cached it switches to the local path before
 * expo-video has had time to start buffering (~10 ms vs ~1-2 s).
 *
 * After a first-view background download the local URI is NOT swapped in —
 * that would reset playback to 0:00. The cached file is picked up on the
 * next visit instead.
 *
 * Web: no filesystem access — always streams from the remote URL.
 */
export function useVideoSource(remoteUrl: string | null) {
    const [localUri, setLocalUri] = useState<string | null>(remoteUrl)

    useEffect(() => {
        // Always give the player a valid remote source immediately
        setLocalUri(remoteUrl)

        if (!remoteUrl || Platform.OS === 'web') return

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
                // Already cached — upgrade to local file before buffering starts
                if (!cancelled) setLocalUri(localPath)
                return
            }

            // Download in background for future visits.
            // Do NOT update localUri after completion — switching source
            // mid-stream causes expo-video to reset playback to 0:00.
            try {
                await FileSystem.downloadAsync(remoteUrl!, localPath)
            } catch (e) {
                console.warn('[useVideoSource] background cache download failed', e)
            }
        }

        resolve()
        return () => { cancelled = true }
    }, [remoteUrl])

    return { localUri }
}
