import React, { useEffect, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import ThemedText from 'Components/ThemedText'
import { useTheme } from 'constants/useTheme'

type LocalSegmentPlayerProps = {
    source: string
    startTime?: number
    endTime?: number | null
    tapToToggle?: boolean
    showNativeControls?: boolean
    showCustomControls?: boolean
    speedOptions?: number[]
    liveSeekWhileScrubbing?: boolean
    liveSeekIntervalMs?: number
}

function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(safeSeconds / 60)
    const remainder = safeSeconds % 60
    return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export default function LocalSegmentPlayer({
    source,
    startTime = 0,
    endTime = null,
    tapToToggle = true,
    showNativeControls = false,
    showCustomControls = true,
    speedOptions = [0.5, 1],
    liveSeekWhileScrubbing = true,
    liveSeekIntervalMs = 50,
}: LocalSegmentPlayerProps) {
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
    const [isScrubbing, setIsScrubbing] = useState(false)
    const [scrubWidth, setScrubWidth] = useState(0)
    const [scrubTime, setScrubTime] = useState(startTime)
    const wasPlayingBeforeScrubRef = useRef(false)
    const scrubTimeRef = useRef(startTime)
    const lastLiveSeekAtRef = useRef(0)

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
            if (!isScrubbing) {
                setCurrentTime(nextTime)
            }

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
    }, [duration, endTime, loop, player, startTime, isScrubbing])

    useEffect(() => {
        player.pause()
        player.currentTime = startTime
        setCurrentTime(startTime)
        setScrubTime(startTime)
    }, [player, source, startTime, endTime])

    useEffect(() => {
        if (!isScrubbing) {
            setScrubTime(currentTime)
        }
    }, [currentTime, isScrubbing])

    useEffect(() => {
        scrubTimeRef.current = scrubTime
    }, [scrubTime])

    const playbackEnd = endTime ?? duration
    const seekMin = startTime
    const seekMax = Math.max(seekMin, playbackEnd)
    const seekRange = Math.max(0, seekMax - seekMin)
    const activeTime = isScrubbing ? scrubTime : currentTime
    const scrubProgress = seekRange > 0 ? (Math.max(seekMin, Math.min(seekMax, activeTime)) - seekMin) / seekRange : 0

    function getTimeFromFraction(fraction: number) {
        const clampedFraction = Math.max(0, Math.min(1, fraction))
        return seekMin + (seekRange * clampedFraction)
    }

    function applySeek(nextTime: number) {
        const clampedTime = Math.max(seekMin, Math.min(seekMax, nextTime))
        player.currentTime = clampedTime
        setCurrentTime(clampedTime)
        setScrubTime(clampedTime)
        scrubTimeRef.current = clampedTime
    }

    function previewSeek(nextTime: number) {
        const clampedTime = Math.max(seekMin, Math.min(seekMax, nextTime))
        setScrubTime(clampedTime)
        scrubTimeRef.current = clampedTime
    }

    function seekFromLocationX(locationX: number, shouldApply: boolean) {
        if (scrubWidth <= 0) return
        const nextTime = getTimeFromFraction(locationX / scrubWidth)
        if (shouldApply) {
            applySeek(nextTime)
            return
        }

        if (liveSeekWhileScrubbing) {
            const now = Date.now()
            if (now - lastLiveSeekAtRef.current >= Math.max(16, liveSeekIntervalMs)) {
                applySeek(nextTime)
                lastLiveSeekAtRef.current = now
                return
            }
        }

        previewSeek(nextTime)
    }

    const scrubPanResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
            wasPlayingBeforeScrubRef.current = isPlaying
            setIsScrubbing(true)
            player.pause()
            lastLiveSeekAtRef.current = 0
            seekFromLocationX(event.nativeEvent.locationX, false)
        },
        onPanResponderMove: (event) => {
            // Update the thumb/timer immediately while dragging for a smoother feel.
            seekFromLocationX(event.nativeEvent.locationX, false)
        },
        onPanResponderRelease: () => {
            applySeek(scrubTimeRef.current)
            setIsScrubbing(false)
            if (wasPlayingBeforeScrubRef.current) {
                player.play()
            }
        },
        onPanResponderTerminate: () => {
            applySeek(scrubTimeRef.current)
            setIsScrubbing(false)
            if (wasPlayingBeforeScrubRef.current) {
                player.play()
            }
        },
    })

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

    function cycleSpeed() {
        const validOptions = speedOptions.length > 0 ? speedOptions : [1]
        const currentIndex = validOptions.findIndex((option) => option === speed)
        const nextSpeed = validOptions[(currentIndex + 1 + validOptions.length) % validOptions.length]
        setSpeed(nextSpeed)
        player.playbackRate = nextSpeed
    }

    return (
        <View>
            <Pressable
                onPress={tapToToggle ? togglePlayback : undefined}
                style={styles.videoTouchSurface}
            >
                <VideoView
                    player={player}
                    style={styles.video}
                    // Keep native controls optional; disabled by default to avoid dim overlay on tap.
                    nativeControls={showNativeControls}
                    contentFit="contain"
                    allowsPictureInPicture={false}
                />
            </Pressable>

            {showCustomControls ? (
                <View style={[styles.controls, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.timelineRow}>
                        <ThemedText variant="small">{formatTime(activeTime)}</ThemedText>
                        <ThemedText variant="small">{formatTime(endTime ?? duration)}</ThemedText>
                    </View>
                    <View
                        style={[styles.scrubTrack, { backgroundColor: colors.border }]}
                        onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}
                        {...scrubPanResponder.panHandlers}
                    >
                        <View style={[styles.scrubProgress, { width: `${scrubProgress * 100}%`, backgroundColor: colors.primary }]} />
                        <View
                            style={[
                                styles.scrubThumb,
                                {
                                    left: `${scrubProgress * 100}%`,
                                    borderColor: colors.primary,
                                    backgroundColor: colors.card,
                                },
                            ]}
                        />
                    </View>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity onPress={togglePlayback} style={[styles.playButton, { backgroundColor: colors.primary }]}>
                            <ThemedText style={{ color: colors.onPrimary, fontWeight: '700' }}>{isPlaying ? 'Pause' : 'Play'}</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={cycleSpeed} style={[styles.controlButton, { borderColor: colors.border }]}>
                            <ThemedText variant="small">{speed}x</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setLoop((value) => !value)} style={[styles.controlButton, { borderColor: loop ? colors.primary : colors.border }]}>
                            <ThemedText variant="small">Loop</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}
        </View>
    )
}

const styles = StyleSheet.create({
    video: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    videoTouchSurface: {
        width: '100%',
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
    scrubTrack: {
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        overflow: 'visible',
    },
    scrubProgress: {
        position: 'absolute',
        left: 0,
        height: 4,
        borderRadius: 2,
    },
    scrubThumb: {
        position: 'absolute',
        marginLeft: -7,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
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
