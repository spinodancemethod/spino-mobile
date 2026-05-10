import React, { useCallback, useRef, useState } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { VideoView } from 'expo-video'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useCustomVideoPlayer } from 'lib/hooks/useCustomVideoPlayer'

interface CustomVideoPlayerProps {
    source: string
    style?: StyleProp<ViewStyle>
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function CustomVideoPlayer({ source, style }: CustomVideoPlayerProps) {
    const {
        player,
        isPlaying,
        isPlayingSv,
        duration,
        durationSv,
        currentTimeSv,
        togglePlayPause,
        pauseForScrub,
        seekTo,
        resumePlayback,
    } = useCustomVideoPlayer(source)

    // Shared values — all gesture state lives here to avoid React re-renders during pan
    const videoWidth = useSharedValue(300)
    const isScrubbing = useSharedValue(false)
    const scrubPosition = useSharedValue(0)
    const basePositionOnDrag = useSharedValue(0)
    const wasPlaying = useSharedValue(false)
    const overlayOpacity = useSharedValue(0)
    const scrubOverlayOpacity = useSharedValue(0)

    // Scrub timestamp shown in the overlay — updated via runOnJS during pan
    const [scrubDisplayTime, setScrubDisplayTime] = useState(0)

    // Haptic debounce ref — only ever touched on JS thread via runOnJS, so plain ref is fine
    const lastHapticTime = useRef(0)
    const triggerHaptic = useCallback(() => {
        const now = Date.now()
        if (now - lastHapticTime.current > 150) {
            lastHapticTime.current = now
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }
    }, [])

    const updateScrubDisplay = useCallback((v: number) => {
        setScrubDisplayTime(v)
    }, [])

    const commitScrub = useCallback((position: number, shouldResume: boolean) => {
        seekTo(position)
        if (shouldResume) {
            // Small delay to let seek settle before resuming
            setTimeout(() => resumePlayback(), 80)
        }
    }, [seekTo, resumePlayback])

    const tap = Gesture.Tap()
        .maxDuration(250)
        .onEnd(() => {
            'worklet'
            runOnJS(togglePlayPause)()
            overlayOpacity.value = 1
            overlayOpacity.value = withDelay(600, withTiming(0, { duration: 300 }))
        })

    const pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-20, 20])
        .onBegin(() => {
            'worklet'
            isScrubbing.value = true
            wasPlaying.value = isPlayingSv.value
            basePositionOnDrag.value = currentTimeSv.value
            scrubPosition.value = currentTimeSv.value
            runOnJS(pauseForScrub)()
            scrubOverlayOpacity.value = withTiming(1, { duration: 150 })
        })
        .onUpdate((e) => {
            'worklet'
            const delta = (e.translationX / videoWidth.value) * durationSv.value
            const next = Math.max(0, Math.min(durationSv.value, basePositionOnDrag.value + delta))
            scrubPosition.value = next
            runOnJS(updateScrubDisplay)(next)
            runOnJS(triggerHaptic)()
        })
        .onEnd(() => {
            'worklet'
            const finalPos = scrubPosition.value
            const resume = wasPlaying.value
            isScrubbing.value = false
            scrubOverlayOpacity.value = withTiming(0, { duration: 200 })
            runOnJS(commitScrub)(finalPos, resume)
        })
        .onFinalize(() => {
            'worklet'
            // Clean up if gesture is cancelled (e.g. interrupted by scroll)
            if (isScrubbing.value) {
                isScrubbing.value = false
                scrubOverlayOpacity.value = withTiming(0, { duration: 200 })
            }
        })

    // Pan wins over tap when horizontal movement exceeds threshold
    const gesture = Gesture.Exclusive(pan, tap)

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }))

    const scrubOverlayStyle = useAnimatedStyle(() => ({
        opacity: scrubOverlayOpacity.value,
    }))

    const progressStyle = useAnimatedStyle(() => {
        const pos = isScrubbing.value ? scrubPosition.value : currentTimeSv.value
        const dur = durationSv.value
        const pct = dur > 0 ? (pos / dur) * 100 : 0
        return { width: `${pct}%` }
    })

    return (
        <GestureDetector gesture={gesture}>
            <View
                style={[styles.container, style]}
                onLayout={(e) => {
                    videoWidth.value = e.nativeEvent.layout.width
                }}
            >
                <VideoView
                    player={player}
                    style={styles.video}
                    nativeControls={false}
                    contentFit="contain"
                    allowsFullscreen={false}
                    allowsPictureInPicture={false}
                />

                {/* Play/Pause flash overlay */}
                <Animated.View
                    style={[styles.overlay, overlayStyle]}
                    pointerEvents="none"
                >
                    <View style={styles.iconCircle}>
                        <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={36}
                            color="#fff"
                        />
                    </View>
                </Animated.View>

                {/* Scrub timestamp overlay */}
                <Animated.View
                    style={[styles.scrubOverlay, scrubOverlayStyle]}
                    pointerEvents="none"
                >
                    <View style={styles.timestampPill}>
                        <Animated.Text style={styles.timestampText}>
                            {formatTime(scrubDisplayTime)}
                            {duration > 0 ? ` / ${formatTime(duration)}` : ''}
                        </Animated.Text>
                    </View>
                </Animated.View>

                {/* Thin progress bar at bottom */}
                <View style={styles.progressTrack} pointerEvents="none">
                    <Animated.View style={[styles.progressFill, progressStyle]} />
                </View>
            </View>
        </GestureDetector>
    )
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        aspectRatio: 4 / 3,
        backgroundColor: '#000',
        borderRadius: 8,
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrubOverlay: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
    },
    timestampPill: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    timestampText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    progressTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    progressFill: {
        height: 3,
        backgroundColor: '#fff',
        borderRadius: 1.5,
    },
})
