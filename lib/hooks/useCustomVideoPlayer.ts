import { useCallback, useEffect, useRef, useState } from 'react'
import { useVideoPlayer } from 'expo-video'
import { useSharedValue } from 'react-native-reanimated'

export function useCustomVideoPlayer(source: string) {
    const expoPlayer = useVideoPlayer(source, (p) => {
        p.loop = false
        p.muted = false
        p.timeUpdateEventInterval = 0.25
    })

    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    // Debounce rapid seeks: if a seek fires while one is in flight, queue the
    // latest target and dispatch it on the next timeUpdate tick.
    const seekInFlightRef = useRef(false)
    const seekPendingRef = useRef<number | null>(null)

    const isPlayingSv = useSharedValue(false)
    const currentTimeSv = useSharedValue(0)
    const durationSv = useSharedValue(0)

    useEffect(() => {
        const sub = expoPlayer.addListener('playingChange', (payload) => {
            const playing = payload.isPlaying
            setIsPlaying(playing)
            isPlayingSv.value = playing
        })
        return () => sub.remove()
    }, [expoPlayer])

    useEffect(() => {
        const sub = expoPlayer.addListener('timeUpdate', (payload) => {
            const t = payload.currentTime
            // Drain any queued seek once the player has advanced
            if (seekInFlightRef.current) {
                if (seekPendingRef.current !== null) {
                    const target = seekPendingRef.current
                    seekPendingRef.current = null
                    expoPlayer.currentTime = target
                    currentTimeSv.value = target
                } else {
                    seekInFlightRef.current = false
                }
                return
            }
            setCurrentTime(t)
            currentTimeSv.value = t
        })
        return () => sub.remove()
    }, [expoPlayer])

    useEffect(() => {
        const sub = expoPlayer.addListener('statusChange', (payload) => {
            if (payload.status === 'readyToPlay') {
                const d = expoPlayer.duration ?? 0
                setDuration(d)
                durationSv.value = d
            }
        })
        return () => sub.remove()
    }, [expoPlayer])

    const togglePlayPause = useCallback(() => {
        if (expoPlayer.playing) {
            expoPlayer.pause()
        } else {
            expoPlayer.play()
        }
    }, [expoPlayer])

    const seekTo = useCallback((seconds: number) => {
        currentTimeSv.value = seconds
        if (seekInFlightRef.current) {
            seekPendingRef.current = seconds
        } else {
            seekInFlightRef.current = true
            expoPlayer.currentTime = seconds
        }
    }, [expoPlayer, currentTimeSv])

    const seekBy = useCallback((delta: number) => {
        const newTime = Math.max(0, Math.min(durationSv.value, currentTimeSv.value + delta))
        seekTo(newTime)
    }, [currentTimeSv, durationSv, seekTo])

    const pauseForScrub = useCallback(() => {
        if (expoPlayer.playing) expoPlayer.pause()
    }, [expoPlayer])

    const resumeIfWasPlaying = useCallback((force = false) => {
        if (force) expoPlayer.play()
    }, [expoPlayer])

    return {
        expoPlayer,
        isPlaying,
        isPlayingSv,
        duration,
        durationSv,
        currentTime,
        currentTimeSv,
        togglePlayPause,
        seekTo,
        seekBy,
        pauseForScrub,
        resumeIfWasPlaying,
    }
}
