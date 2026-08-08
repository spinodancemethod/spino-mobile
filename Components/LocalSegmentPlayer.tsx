import React, { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import ThemedText from 'Components/ThemedText'
import { useTheme } from 'constants/useTheme'

type LocalSegmentPlayerProps = {
    source: string
    startTime?: number
    endTime?: number | null
}

function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(safeSeconds / 60)
    const remainder = safeSeconds % 60
    return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export default function LocalSegmentPlayer({ source, startTime = 0, endTime = null }: LocalSegmentPlayerProps) {
    const { colors } = useTheme()
    const player = useVideoPlayer(source, (videoPlayer) => {
        videoPlayer.loop = false
        videoPlayer.muted = false
        videoPlayer.timeUpdateEventInterval = 0.1
    })
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(startTime)
    const [duration, setDuration] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [loop, setLoop] = useState(false)

    useEffect(() => {
        const subscription = player.addListener('playingChange', ({ isPlaying: playing }) => {
            setIsPlaying(playing)
        })
        return () => subscription.remove()
    }, [player])

    useEffect(() => {
        const subscription = player.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') {
                setDuration(player.duration ?? 0)
            }
        })
        return () => subscription.remove()
    }, [player])

    useEffect(() => {
        const subscription = player.addListener('timeUpdate', ({ currentTime: nextTime }) => {
            const rangeEnd = endTime == null ? null : Math.min(endTime, duration || endTime)
            setCurrentTime(nextTime)

            if (rangeEnd != null && nextTime >= rangeEnd) {
                player.pause()
                player.currentTime = rangeEnd
                if (loop) {
                    player.currentTime = startTime
                    player.play()
                }
            }
        })
        return () => subscription.remove()
    }, [duration, endTime, loop, player, startTime])

    useEffect(() => {
        player.pause()
        player.currentTime = startTime
        setCurrentTime(startTime)
    }, [player, source, startTime, endTime])

    function togglePlayback() {
        if (isPlaying) {
            player.pause()
            return
        }

        if (endTime != null && currentTime >= endTime) {
            player.currentTime = startTime
        }
        player.play()
    }

    function seekBy(delta: number) {
        const maximum = endTime ?? duration
        const nextTime = Math.max(startTime, Math.min(maximum, currentTime + delta))
        player.currentTime = nextTime
        setCurrentTime(nextTime)
    }

    function cycleSpeed() {
        const nextSpeed = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 0.75 : 1
        setSpeed(nextSpeed)
        player.playbackRate = nextSpeed
    }

    return (
        <View>
            <VideoView
                player={player}
                style={styles.video}
                nativeControls
                contentFit="contain"
                allowsPictureInPicture={false}
            />
            <View style={[styles.controls, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.timelineRow}>
                    <ThemedText variant="small">{formatTime(currentTime)}</ThemedText>
                    <ThemedText variant="small">{formatTime(endTime ?? duration)}</ThemedText>
                </View>
                <View style={styles.buttonRow}>
                    <TouchableOpacity onPress={() => seekBy(-5)} style={[styles.controlButton, { borderColor: colors.border }]}>
                        <ThemedText variant="small">-5s</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={togglePlayback} style={[styles.playButton, { backgroundColor: colors.primary }]}>
                        <ThemedText style={{ color: colors.onPrimary, fontWeight: '700' }}>{isPlaying ? 'Pause' : 'Play'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => seekBy(5)} style={[styles.controlButton, { borderColor: colors.border }]}>
                        <ThemedText variant="small">+5s</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cycleSpeed} style={[styles.controlButton, { borderColor: colors.border }]}>
                        <ThemedText variant="small">{speed}x</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLoop((value) => !value)} style={[styles.controlButton, { borderColor: loop ? colors.primary : colors.border }]}>
                        <ThemedText variant="small">Loop</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    video: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    controls: {
        borderWidth: 1,
        borderTopWidth: 0,
        padding: 10,
        gap: 8,
    },
    timelineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
    },
    controlButton: {
        borderWidth: 1,
        borderRadius: 6,
        minHeight: 36,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        borderRadius: 6,
        minHeight: 36,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
})
