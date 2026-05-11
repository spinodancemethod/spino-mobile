import React, { useCallback } from 'react'
import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native'
import { VideoView } from 'expo-video'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useCustomVideoPlayer } from '../lib/hooks/useCustomVideoPlayer'

// Worklet-safe formatter — runs on UI thread, no String() constructor needed
function formatTimeWorklet(seconds: number): string {
    'worklet'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return m + ':' + (s < 10 ? '0' + s : '' + s)
}

// AnimatedTextInput lets useAnimatedProps drive text content entirely on the
// UI thread — no JS bridge crossing, no React re-renders during scrub.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

interface CustomVideoPlayerProps {
    source: string
    style?: StyleProp<ViewStyle>
}

export default function CustomVideoPlayer({ source, style }: CustomVideoPlayerProps) {
    const {
        expoPlayer,
        isPlaying,
        isPlayingSv,
        durationSv,
        currentTimeSv,
        togglePlayPause,
        seekTo,
        pauseForScrub,
        resumeIfWasPlaying,
    } = useCustomVideoPlayer(source)

    // Stored as shared value so gesture handlers on the UI thread can read it
    const videoWidth = useSharedValue(300)

    // Scrub state — all shared values, all updates on UI thread
    const isScrubbing = useSharedValue(false)
    const scrubTime = useSharedValue(0)
    const baseTime = useSharedValue(0)       // playback time captured at pan start
    const wasPlaying = useSharedValue(false) // playing state captured at pan start
    const lastHapticX = useSharedValue(0)   // last X that fired a haptic (throttle)
    // Overlay visibility
    const iconOpacity = useSharedValue(0)
    const scrubOpacity = useSharedValue(0)

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }, [])

    const scrubTo = useCallback(
        (target: number, resume = false) => {
            seekTo(target)
            if (resume) {
                resumeIfWasPlaying(true)
            }
        },
        [resumeIfWasPlaying, seekTo]
    )

    const pan = Gesture.Pan()
        .minDistance(5)
        .onStart(() => {
            'worklet'
            wasPlaying.value = isPlayingSv.value
            baseTime.value = currentTimeSv.value
            scrubTime.value = currentTimeSv.value
            lastHapticX.value = 0
            isScrubbing.value = true
            scrubOpacity.value = withTiming(1, { duration: 150 })
            runOnJS(pauseForScrub)()
        })
        .onUpdate((e) => {
            'worklet'
            const delta = (e.translationX / videoWidth.value) * durationSv.value
            const newScrubTime = Math.max(0, Math.min(durationSv.value, baseTime.value + delta))
            scrubTime.value = newScrubTime
            runOnJS(seekTo)(newScrubTime)

            if (Math.abs(e.translationX - lastHapticX.value) > 15) {
                lastHapticX.value = e.translationX
                runOnJS(triggerHaptic)()
            }
        })
        .onEnd(() => {
            'worklet'
            isScrubbing.value = false
            scrubOpacity.value = withTiming(0, { duration: 200 })
            runOnJS(scrubTo)(scrubTime.value, wasPlaying.value)
        })
        .onFinalize(() => {
            'worklet'
            if (isScrubbing.value) {
                isScrubbing.value = false
                scrubOpacity.value = withTiming(0, { duration: 200 })
                runOnJS(scrubTo)(scrubTime.value, wasPlaying.value)
            }
        })

    // ─── Tap gesture: play/pause with brief icon flash ─────────────────────────

    const tap = Gesture.Tap()
        .maxDuration(250)
        .maxDeltaX(10)
        .maxDeltaY(10)
        .onEnd(() => {
            'worklet'
            runOnJS(togglePlayPause)()
            iconOpacity.value = 1
            iconOpacity.value = withDelay(600, withTiming(0, { duration: 300 }))
        })

    // Pan takes priority; tap only activates when pan fails (no horizontal movement)
    const gesture = Gesture.Exclusive(pan, tap)

    // ─── Animated styles ───────────────────────────────────────────────────────

    const iconOverlayStyle = useAnimatedStyle(() => ({
        opacity: iconOpacity.value,
    }))

    const scrubOverlayStyle = useAnimatedStyle(() => ({
        opacity: scrubOpacity.value,
    }))

    // Progress bar width in pixels (not %) so the calculation stays on UI thread
    const progressStyle = useAnimatedStyle(() => {
        const pos = isScrubbing.value ? scrubTime.value : currentTimeSv.value
        const dur = durationSv.value
        return { width: dur > 0 ? (pos / dur) * videoWidth.value : 0 }
    })

    // Timestamp text driven entirely on the UI thread via animated props.
    // No React state, no bridge crossings, no VideoView re-renders during scrub.
    const timestampProps = useAnimatedProps(() => {
        const t = isScrubbing.value ? scrubTime.value : currentTimeSv.value
        const dur = durationSv.value
        const text = formatTimeWorklet(t) + (dur > 0 ? ' / ' + formatTimeWorklet(dur) : '')
        return { text, defaultValue: text }
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
                    player={expoPlayer}
                    style={styles.video}
                    nativeControls={false}
                    contentFit="contain"
                    allowsPictureInPicture={false}
                />

                {/* Play/pause flash — fades after 900ms total */}
                <Animated.View style={[styles.overlay, iconOverlayStyle]} pointerEvents="none">
                    <View style={styles.iconCircle}>
                        <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={36}
                            color="#fff"
                        />
                    </View>
                </Animated.View>

                {/* Scrub timestamp — text stays on UI thread via AnimatedTextInput */}
                <Animated.View style={[styles.scrubOverlay, scrubOverlayStyle]} pointerEvents="none">
                    <View style={styles.timestampPill}>
                        <AnimatedTextInput
                            style={styles.timestampText}
                            animatedProps={timestampProps}
                            editable={false}
                            caretHidden
                            underlineColorAndroid="transparent"
                        />
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
        backgroundColor: 'transparent',
        padding: 0,
        margin: 0,
        minWidth: 80,
        textAlign: 'center',
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
