import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Video, { VideoRef } from 'react-native-video'
import { useVideoPlayer } from 'expo-video'
import { useSharedValue } from 'react-native-reanimated'

export function useCustomVideoPlayer(source: string) {
    const isWeb = Platform.OS === 'web'

    // Web implementation using expo-video
    const expoPlayer = useVideoPlayer(source, (p) => {
        p.loop = false
        p.muted = false
        p.timeUpdateEventInterval = 0.25
    })

    // Native implementation using react-native-video
    const videoRef = useRef<VideoRef>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const seekInFlightRef = useRef(false)
    const seekPendingRef = useRef<number | null>(null)

    const isPlayingSv = useSharedValue(false)
    const currentTimeSv = useSharedValue(0)
    const durationSv = useSharedValue(0)

    // Expo player listeners (web only)
    useEffect(() => {
        if (!isWeb) return
        const sub = expoPlayer.addListener('playingChange', (payload) => {
            const playing = payload.isPlaying
            setIsPlaying(playing)
            isPlayingSv.value = playing
        })
        return () => sub.remove()
    }, [expoPlayer, isWeb])

    useEffect(() => {
        if (!isWeb) return
        const sub = expoPlayer.addListener('timeUpdate', (payload) => {
            const t = payload.currentTime
            setCurrentTime(t)
            currentTimeSv.value = t
        })
        return () => sub.remove()
    }, [expoPlayer, isWeb])

    useEffect(() => {
        if (!isWeb) return
        const sub = expoPlayer.addListener('statusChange', (payload) => {
            if (payload.status === 'readyToPlay') {
                const d = expoPlayer.duration ?? 0
                setDuration(d)
                durationSv.value = d
            }
        })
        return () => sub.remove()
    }, [expoPlayer, isWeb])

    // React Native Video event handlers (native only)
    const onLoad = useCallback((data: any) => {
        if (isWeb) return
        setDuration(data.duration)
        durationSv.value = data.duration
    }, [durationSv, isWeb])

    const onProgress = useCallback((data: any) => {
        if (isWeb) return
        if (!seekInFlightRef.current) {
            setCurrentTime(data.currentTime)
            currentTimeSv.value = data.currentTime
        }
    }, [currentTimeSv, isWeb])

    const onEnd = useCallback(() => {
        if (isWeb) return
        setIsPlaying(false)
        isPlayingSv.value = false
    }, [isPlayingSv, isWeb])

    const onSeek = useCallback((_data: any) => {
        if (isWeb) return
        if (seekPendingRef.current !== null) {
            const target = seekPendingRef.current
            seekPendingRef.current = null
            videoRef.current?.seek(target, 50)
        } else {
            seekInFlightRef.current = false
        }
    }, [isWeb])

    // Unified API functions
    const togglePlayPause = useCallback(() => {
        if (isWeb) {
            if (expoPlayer.playing) {
                expoPlayer.pause()
            } else {
                expoPlayer.play()
            }
        } else {
            setIsPlaying(prev => !prev)
            isPlayingSv.value = !isPlayingSv.value
        }
    }, [expoPlayer, isPlayingSv, isWeb])

    const seekTo = useCallback((seconds: number) => {
        if (isWeb) {
            expoPlayer.currentTime = seconds
            return
        }
        if (!videoRef.current) return
        currentTimeSv.value = seconds
        if (seekInFlightRef.current) {
            seekPendingRef.current = seconds
        } else {
            seekInFlightRef.current = true
            videoRef.current.seek(seconds, 500)
        }
    }, [expoPlayer, currentTimeSv, isWeb])

    const seekBy = useCallback((delta: number) => {
        const newTime = Math.max(0, Math.min(durationSv.value, currentTimeSv.value + delta))
        seekTo(newTime)
    }, [currentTimeSv, durationSv, seekTo])

    const pauseForScrub = useCallback(() => {
        if (isWeb) {
            if (expoPlayer.playing) expoPlayer.pause()
        } else {
            setIsPlaying(false)
            isPlayingSv.value = false
        }
    }, [expoPlayer, isPlayingSv, isWeb])

    const resumeIfWasPlaying = useCallback((force = false) => {
        if (isWeb) {
            if (force) expoPlayer.play()
        } else {
            if (force) {
                setIsPlaying(true)
                isPlayingSv.value = true
            }
        }
    }, [expoPlayer, isPlayingSv, isWeb])

    return {
        // Platform-specific refs/players
        expoPlayer: isWeb ? expoPlayer : null,
        videoRef: !isWeb ? videoRef : null,

        // Unified state
        isPlaying,
        isPlayingSv,
        duration,
        durationSv,
        currentTime,
        currentTimeSv,

        // Unified functions
        togglePlayPause,
        seekTo,
        seekBy,
        pauseForScrub,
        resumeIfWasPlaying,

        // Native-only event handlers
        onLoad,
        onProgress,
        onEnd,
        onSeek,
    }
}
