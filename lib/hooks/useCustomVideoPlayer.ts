import { useCallback, useEffect, useState } from 'react'
import { useVideoPlayer } from 'expo-video'
import { useSharedValue } from 'react-native-reanimated'

export function useCustomVideoPlayer(source: string) {
    const player = useVideoPlayer(source, (p) => {
        p.loop = false
        p.muted = false
        p.timeUpdateEventInterval = 0.25
    })

    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    const isPlayingSv = useSharedValue(false)
    const currentTimeSv = useSharedValue(0)
    const durationSv = useSharedValue(0)

    useEffect(() => {
        const sub = player.addListener('playingChange', (payload) => {
            const playing = payload.isPlaying
            setIsPlaying(playing)
            isPlayingSv.value = playing
        })
        return () => sub.remove()
    }, [player])

    useEffect(() => {
        const sub = player.addListener('timeUpdate', (payload) => {
            const t = payload.currentTime
            setCurrentTime(t)
            currentTimeSv.value = t
        })
        return () => sub.remove()
    }, [player])

    useEffect(() => {
        const sub = player.addListener('statusChange', (payload) => {
            if (payload.status === 'readyToPlay') {
                const d = player.duration ?? 0
                setDuration(d)
                durationSv.value = d
            }
        })
        return () => sub.remove()
    }, [player])

    useEffect(() => {
        setIsPlaying(false)
        setCurrentTime(0)
        isPlayingSv.value = false
        currentTimeSv.value = 0
    }, [source])

    const togglePlayPause = useCallback(() => {
        if (player.playing) {
            player.pause()
        } else {
            player.play()
        }
    }, [player])

    const pauseForScrub = useCallback(() => {
        if (player.playing) {
            player.pause()
        }
    }, [player])

    const seekTo = useCallback((seconds: number) => {
        player.currentTime = seconds
    }, [player])

    const resumePlayback = useCallback(() => {
        player.play()
    }, [player])

    return {
        player,
        isPlaying,
        isPlayingSv,
        duration,
        durationSv,
        currentTime,
        currentTimeSv,
        togglePlayPause,
        pauseForScrub,
        seekTo,
        resumePlayback,
    }
}
