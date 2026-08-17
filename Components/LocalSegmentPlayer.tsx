import React, { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import ThemedText from 'Components/ThemedText'
import { useTheme } from 'constants/useTheme'

type LocalSegmentPlayerProps = {
    source: string
    startTime?: number
    endTime?: number | null
    editableRange?: boolean
    enableFullscreen?: boolean
    onRangeChange?: (startTime: number, endTime: number) => void
}

export default function LocalSegmentPlayer({ source, startTime = 0, endTime = null, editableRange = false, enableFullscreen = true, onRangeChange }: LocalSegmentPlayerProps) {
    const { colors } = useTheme()
    const safeStartTime = Number.isFinite(startTime) ? Math.max(0, startTime) : 0
    const safeEndTime = endTime != null && Number.isFinite(endTime) ? Math.max(safeStartTime, endTime) : null
    const player = useVideoPlayer(source, (videoPlayer) => {
        videoPlayer.loop = false
        videoPlayer.muted = true
        videoPlayer.timeUpdateEventInterval = 0.1
    })
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(safeStartTime)
    const [scrubTime, setScrubTime] = useState(safeStartTime)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [loop, setLoop] = useState(false)
    const [isScrubbing, setIsScrubbing] = useState(false)
    const [scrubWidth, setScrubWidth] = useState(0)
    const [rangeTrackWidth, setRangeTrackWidth] = useState(0)
    const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false)
    const lastScrubLocation = useRef<number | null>(null)
    const activeRangeHandle = useRef<'start' | 'end' | null>(null)
    const videoTouchStart = useRef({ x: 0, y: 0 })
    const videoTouchMoved = useRef(false)

    useEffect(() => {
        if (!enableFullscreen) setIsFullscreen(false)
    }, [enableFullscreen])

    useEffect(() => {
        const subscription = player.addListener('playingChange', ({ isPlaying: playing }) => setIsPlaying(playing))
        return () => subscription.remove()
    }, [player])

    useEffect(() => {
        const subscription = player.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') setDuration(player.duration ?? 0)
        })
        return () => subscription.remove()
    }, [player])

    useEffect(() => {
        const subscription = player.addListener('timeUpdate', ({ currentTime: nextTime }) => {
            if (!isScrubbing) {
                setCurrentTime(nextTime)
                setScrubTime(nextTime)
            }
            const rangeEnd = safeEndTime == null ? null : Math.min(safeEndTime, duration || safeEndTime)
            if (!isScrubbing && rangeEnd != null && nextTime >= rangeEnd) {
                player.pause()
                player.currentTime = rangeEnd
                if (loop) {
                    player.currentTime = safeStartTime
                    player.play()
                }
            }
        })
        return () => subscription.remove()
    }, [duration, isScrubbing, loop, player, safeEndTime, safeStartTime])

    useEffect(() => {
        player.pause()
        player.currentTime = safeStartTime
        setCurrentTime(safeStartTime)
        setScrubTime(safeStartTime)
    }, [player, safeEndTime, safeStartTime, source])

    const seekMin = Math.min(safeStartTime, duration || safeStartTime)
    const seekMax = Math.max(seekMin, safeEndTime ?? duration)
    const seekRange = Math.max(0, seekMax - seekMin)
    const rangeDuration = duration > 0 ? duration : Math.max(safeEndTime ?? 0, safeStartTime)
    const minimumRange = Math.min(0.1, rangeDuration / 2)
    const activeTime = isScrubbing ? scrubTime : currentTime
    const progress = seekRange > 0
        ? (Math.max(seekMin, Math.min(seekMax, activeTime)) - seekMin) / seekRange
        : 0

    function formatSeconds(seconds: number) {
        const safeSeconds = Math.max(0, Math.round(seconds * 100) / 100)
        return `${safeSeconds.toFixed(2)}s`
    }

    function applyScrubLocation(locationX: number) {
        if (scrubWidth <= 0) return
        if (!Number.isFinite(locationX)) return

        // Ignore transient responder resets to zero during a drag unless the
        // finger was already near the start of the track.
        if (locationX === 0 && (lastScrubLocation.current ?? 0) > scrubWidth * 0.05) return

        lastScrubLocation.current = Math.max(0, Math.min(scrubWidth, locationX))
        const fraction = Math.max(0, Math.min(1, locationX / scrubWidth))
        const nextTime = seekMin + seekRange * fraction
        player.currentTime = nextTime
        setCurrentTime(nextTime)
        setScrubTime(nextTime)
    }

    function beginScrub(locationX: number) {
        setWasPlayingBeforeScrub(player.playing)
        setIsScrubbing(true)
        player.pause()
        lastScrubLocation.current = null
        applyScrubLocation(locationX)
    }

    function finishScrub() {
        setIsScrubbing(false)
        lastScrubLocation.current = null
        if (wasPlayingBeforeScrub) player.play()
    }

    function applyRangeLocation(locationX: number) {
        if (rangeTrackWidth <= 0 || rangeDuration <= 0 || !activeRangeHandle.current) return
        const fraction = Math.max(0, Math.min(1, locationX / rangeTrackWidth))
        const nextTime = fraction * rangeDuration
        const currentStart = Math.max(0, Math.min(safeStartTime, rangeDuration))
        const currentEnd = Math.max(currentStart + minimumRange, Math.min(safeEndTime ?? rangeDuration, rangeDuration))
        const nextStart = activeRangeHandle.current === 'start'
            ? Math.min(nextTime, currentEnd - minimumRange)
            : currentStart
        const nextEnd = activeRangeHandle.current === 'end'
            ? Math.max(nextTime, currentStart + minimumRange)
            : currentEnd
        onRangeChange?.(Math.max(0, nextStart), Math.min(rangeDuration, nextEnd))
    }

    function beginRangeDrag(locationX: number) {
        if (!editableRange || rangeTrackWidth <= 0 || rangeDuration <= 0) return
        const startLocation = (safeStartTime / rangeDuration) * rangeTrackWidth
        const endLocation = ((safeEndTime ?? rangeDuration) / rangeDuration) * rangeTrackWidth
        activeRangeHandle.current = Math.abs(locationX - startLocation) <= Math.abs(locationX - endLocation) ? 'start' : 'end'
        player.pause()
        applyRangeLocation(locationX)
    }

    function finishRangeDrag() {
        activeRangeHandle.current = null
    }

    function togglePlayback() {
        if (isPlaying) {
            player.pause()
            return
        }
        if (safeEndTime != null && currentTime >= safeEndTime) player.currentTime = safeStartTime
        player.play()
    }

    function beginVideoTouch(event: { nativeEvent: { locationX: number; locationY: number } }) {
        videoTouchStart.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }
        videoTouchMoved.current = false
    }

    function trackVideoTouch(event: { nativeEvent: { locationX: number; locationY: number } }) {
        const deltaX = event.nativeEvent.locationX - videoTouchStart.current.x
        const deltaY = event.nativeEvent.locationY - videoTouchStart.current.y
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) videoTouchMoved.current = true
    }

    function finishVideoTouch() {
        if (!videoTouchMoved.current) togglePlayback()
    }

    function toggleSound() {
        const nextMuted = !isMuted
        player.muted = nextMuted
        setIsMuted(nextMuted)
    }

    function cycleSpeed() {
        const options = [0.5, 1]
        const nextSpeed = options[(options.indexOf(speed) + 1) % options.length]
        setSpeed(nextSpeed)
        player.playbackRate = nextSpeed
    }

    function renderControls() {
        const rangeStartProgress = rangeDuration > 0 ? Math.max(0, Math.min(1, safeStartTime / rangeDuration)) : 0
        const rangeEndProgress = rangeDuration > 0 ? Math.max(0, Math.min(1, (safeEndTime ?? rangeDuration) / rangeDuration)) : 1
        return (
            <View style={[styles.controls, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {editableRange ? (
                    <View style={styles.rangeEditor}>
                        <View style={styles.rangeEditorLabels}>
                            <ThemedText variant="small">Trim selection</ThemedText>
                            <ThemedText variant="small">{formatSeconds(safeStartTime)} - {formatSeconds(safeEndTime ?? rangeDuration)}</ThemedText>
                        </View>
                        <View
                            style={[styles.rangeTrack, { backgroundColor: colors.border }]}
                            onLayout={(event) => setRangeTrackWidth(event.nativeEvent.layout.width)}
                            onTouchStart={(event) => beginRangeDrag(event.nativeEvent.locationX)}
                            onTouchMove={(event) => applyRangeLocation(event.nativeEvent.locationX)}
                            onTouchEnd={finishRangeDrag}
                            onTouchCancel={finishRangeDrag}
                        >
                            <View
                                pointerEvents="none"
                                style={[styles.rangeSelected, { left: `${rangeStartProgress * 100}%`, width: `${(rangeEndProgress - rangeStartProgress) * 100}%`, backgroundColor: colors.primary }]}
                            />
                            <View pointerEvents="none" style={[styles.rangeHandle, { left: `${rangeStartProgress * 100}%`, backgroundColor: colors.card, borderColor: colors.primary }]} />
                            <View pointerEvents="none" style={[styles.rangeHandle, { left: `${rangeEndProgress * 100}%`, backgroundColor: colors.card, borderColor: colors.primary }]} />
                        </View>
                    </View>
                ) : null}
                <View style={styles.timeLabels}>
                    <ThemedText variant="small">{formatSeconds(Math.max(seekMin, activeTime))}</ThemedText>
                    <ThemedText variant="small">{formatSeconds(seekMax)}</ThemedText>
                </View>
                <View
                    style={[styles.scrubTouchArea, { backgroundColor: colors.border }]}
                    onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}
                    onTouchStart={(event) => beginScrub(event.nativeEvent.locationX)}
                    onTouchMove={(event) => applyScrubLocation(event.nativeEvent.locationX)}
                    onTouchEnd={finishScrub}
                    onTouchCancel={finishScrub}
                >
                    <View pointerEvents="none" style={[styles.scrubProgress, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
                    <View pointerEvents="none" style={[styles.scrubThumb, { left: `${progress * 100}%`, backgroundColor: colors.card, borderColor: colors.primary }]} />
                </View>
                <View style={styles.buttonRow}>
                    <TouchableOpacity onPress={togglePlayback} style={[styles.playButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}>
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={colors.onPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cycleSpeed} style={[styles.controlButton, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Playback speed ${speed} times`}>
                        <ThemedText variant="small">{speed}x</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLoop((value) => !value)} style={[styles.controlButton, { borderColor: loop ? colors.primary : colors.border }]} accessibilityRole="button" accessibilityLabel={loop ? 'Disable loop' : 'Enable loop'}>
                        <Ionicons name="repeat" size={18} color={loop ? colors.primary : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleSound} style={[styles.controlButton, { borderColor: isMuted ? colors.border : colors.primary }]} accessibilityRole="button" accessibilityLabel={isMuted ? 'Turn sound on' : 'Turn sound off'}>
                        <Ionicons name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={18} color={isMuted ? colors.text : colors.primary} />
                    </TouchableOpacity>
                    {enableFullscreen ? (
                        <TouchableOpacity onPress={() => setIsFullscreen((value) => !value)} style={[styles.controlButton, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                            <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={18} color={colors.text} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            {!isFullscreen ? (
                <View onTouchStart={beginVideoTouch} onTouchMove={trackVideoTouch} onTouchEnd={finishVideoTouch}>
                    <VideoView player={player} style={styles.video} nativeControls={false} contentFit="contain" fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />
                </View>
            ) : null}
            {!isFullscreen ? renderControls() : null}
            {enableFullscreen ? (
                <Modal visible={isFullscreen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setIsFullscreen(false)}>
                    <View style={styles.fullscreenContainer}>
                        <Pressable onPress={togglePlayback} style={styles.fullscreenVideoTouchSurface}>
                            <VideoView player={player} style={styles.fullscreenVideo} nativeControls={false} contentFit="contain" fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />
                        </Pressable>
                        {renderControls()}
                    </View>
                </Modal>
            ) : null}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { width: '100%', backgroundColor: '#000' },
    video: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
    fullscreenContainer: { flex: 1, backgroundColor: '#000' },
    fullscreenVideoTouchSurface: { flex: 1, width: '100%', justifyContent: 'center' },
    fullscreenVideo: { width: '100%', height: '100%' },
    controls: { borderWidth: 1, borderTopWidth: 0, padding: 10, gap: 4 },
    rangeEditor: { gap: 4, paddingBottom: 4 },
    rangeEditorLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rangeTrack: { height: 30, justifyContent: 'center', overflow: 'visible' },
    rangeSelected: { position: 'absolute', height: 5, borderRadius: 3 },
    rangeHandle: { position: 'absolute', marginLeft: -9, width: 18, height: 24, borderRadius: 5, borderWidth: 2 },
    timeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    scrubTouchArea: { height: 28, borderRadius: 14, justifyContent: 'center', overflow: 'visible' },
    scrubProgress: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
    scrubThumb: { position: 'absolute', marginLeft: -8, width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
    buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, height: 36 },
    controlButton: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 6, height: 36, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' },
    playButton: { flex: 1, minWidth: 0, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
})
