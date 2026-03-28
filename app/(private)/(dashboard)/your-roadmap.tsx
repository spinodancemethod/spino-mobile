import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedLike from 'Components/ThemedLike'
import ThemedStar from 'Components/ThemedStar'
import { Ionicons } from '@expo/vector-icons'
import { View, Animated, PanResponder, StyleSheet, TouchableOpacity, Modal, Pressable, Switch, LayoutChangeEvent } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { usePositions } from 'lib/hooks/usePositions'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useVideosByIds } from 'lib/hooks/useVideosByIds'
import { useVideoActionToggles } from 'lib/hooks/useVideoActionToggles'
import { router } from 'expo-router'
import { useTheme } from 'constants/useTheme'

// Scale bounds for pinch-to-zoom so users can inspect the roadmap comfortably.
const MIN_SCALE = 0.2
const MAX_SCALE = 3
const DEFAULT_SCALE = 0.5
const DEFAULT_VIEWPORT_MARGIN_LEFT = 16
const DEFAULT_VIEWPORT_MARGIN_TOP = -440
const DEFAULT_PAN_COMPENSATION_RATIO = 0.6

// Node sizing for the roadmap row layout.
const SURFACE_WIDTH = 1800
const POSITION_COLUMN_WIDTH = 180
const SURFACE_HORIZONTAL_PADDING = 24
const VIDEO_W = 170
const VIDEO_H = 128
const POSITION_BOX_MIN_HEIGHT = VIDEO_H
const VIDEO_MARGIN = 10
const VIDEO_GIF_HEIGHT = 78
const ICON_SIZE = 18
const ROW_GAP = 18
const VIDEO_GAP = 12
const SAMPLE_GIF_URL = 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif'
const SAMPLE_PLACEHOLDER_URL = 'https://placehold.co/240x135/e2e8f0/475569?text=Video+Preview'
const SAMPLE_POSITION_PLACEHOLDER_URL = 'https://placehold.co/320x180/fef3c7/92400e?text=Position+Preview'

const YourRoadmap = () => {
    const { mode, colors } = useTheme()

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

    // Animated state that drives drag and pinch interactions.
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
    const scale = useRef(new Animated.Value(DEFAULT_SCALE)).current

    // Refs preserve gesture state between touch events.
    const lastPan = useRef({ x: 0, y: 0 })
    const lastScale = useRef(DEFAULT_SCALE)
    const initialTouches = useRef<{ x: number; y: number }[] | null>(null)
    const initialDistance = useRef<number | null>(null)
    // Tracks the Animated.View height so the pinch handler can compensate
    // for React Native scaling around the element center, not the origin.
    const surfaceHeightRef = useRef(0)

    // Absolute screen position of the canvas container — needed so the
    // pinch handler can convert pageX/pageY into container-relative coords.
    const canvasRef = useRef<View>(null)
    const canvasOffset = useRef({ x: 0, y: 0 })
    const onCanvasLayout = useCallback((_e: LayoutChangeEvent) => {
        canvasRef.current?.measureInWindow((x, y) => {
            canvasOffset.current = { x: x ?? 0, y: y ?? 0 }
        })
    }, [])

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches
                return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6
            },
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches
                return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6
            },

            onPanResponderGrant: (evt) => {
                const touches = evt.nativeEvent.touches

                pan.x.stopAnimation((x: number) => {
                    pan.y.stopAnimation((y: number) => {
                        lastPan.current = { x, y }
                    })
                })
                scale.stopAnimation((currentScale: number) => {
                    lastScale.current = currentScale
                })

                if (touches && touches.length === 2) {
                    initialTouches.current = [
                        { x: touches[0].pageX, y: touches[0].pageY },
                        { x: touches[1].pageX, y: touches[1].pageY },
                    ]
                    const dx = touches[0].pageX - touches[1].pageX
                    const dy = touches[0].pageY - touches[1].pageY
                    initialDistance.current = Math.sqrt(dx * dx + dy * dy)
                } else {
                    initialTouches.current = null
                    initialDistance.current = null
                }
            },

            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches

                if (touches && touches.length === 2) {
                    if (initialDistance.current == null) {
                        initialTouches.current = [
                            { x: touches[0].pageX, y: touches[0].pageY },
                            { x: touches[1].pageX, y: touches[1].pageY },
                        ]
                        const dx0 = touches[0].pageX - touches[1].pageX
                        const dy0 = touches[0].pageY - touches[1].pageY
                        initialDistance.current = Math.sqrt(dx0 * dx0 + dy0 * dy0)
                    }

                    if (initialDistance.current != null) {
                        const dx = touches[0].pageX - touches[1].pageX
                        const dy = touches[0].pageY - touches[1].pageY
                        const distance = Math.sqrt(dx * dx + dy * dy)
                        const scaleFactor = distance / initialDistance.current
                        const nextScale = clamp(lastScale.current * scaleFactor, MIN_SCALE, MAX_SCALE)
                        scale.setValue(nextScale)

                        // Convert absolute touch positions to canvas-relative
                        // so the focal-point formula works regardless of header offset.
                        const ox = canvasOffset.current.x
                        const oy = canvasOffset.current.y
                        const midX = (touches[0].pageX + touches[1].pageX) / 2 - ox
                        const midY = (touches[0].pageY + touches[1].pageY) / 2 - oy

                        if (initialTouches.current) {
                            const initMidX = (initialTouches.current[0].x + initialTouches.current[1].x) / 2 - ox
                            const initMidY = (initialTouches.current[0].y + initialTouches.current[1].y) / 2 - oy
                            // Focal-point zoom: RN scales around the element center, so
                            // we include a center*(r-1) correction to keep the content
                            // point under the fingers stationary.
                            const r = nextScale / lastScale.current
                            const cx = SURFACE_WIDTH / 2
                            const cy = surfaceHeightRef.current / 2
                            const newPanX = midX + r * (lastPan.current.x - initMidX) + cx * (r - 1)
                            const newPanY = midY + r * (lastPan.current.y - initMidY) + cy * (r - 1)
                            pan.setValue({ x: newPanX, y: newPanY })
                        }
                    }
                } else {
                    pan.setValue({ x: lastPan.current.x + gestureState.dx, y: lastPan.current.y + gestureState.dy })
                }
            },

            onPanResponderRelease: () => {
                pan.x.stopAnimation((x: number) => {
                    pan.y.stopAnimation((y: number) => {
                        lastPan.current = { x, y }
                    })
                })
                scale.stopAnimation((currentScale: number) => {
                    lastScale.current = currentScale
                })
                initialTouches.current = null
                initialDistance.current = null
            },

            onPanResponderTerminationRequest: () => true,
        })
    ).current

    const { data: positions = [] } = usePositions(undefined)
    const { data: favouriteIds = [] } = useFavouritesByUser()
    const { data: favouriteVideos = [] } = useVideosByIds(favouriteIds)
    const [showEmptyPositions, setShowEmptyPositions] = useState(false)
    const [hideCompleted, setHideCompleted] = useState(false)

    const {
        favouriteIdSet,
        deckIdSet,
        completedVideoIdSet,
        isFavouritePending,
        isDeckPending,
        isCompletionPending,
        toggleFavouriteWithFeedback,
        toggleDeckWithFeedback,
        toggleCompletionWithFeedback,
    } = useVideoActionToggles()

    const videosByPosition = useMemo(() => {
        const grouped = new Map<string, any[]>()

        for (const video of favouriteVideos) {
            const positionId = video?.position_id
            if (!positionId) continue
            const current = grouped.get(positionId) ?? []
            current.push(video)
            grouped.set(positionId, current)
        }

        return grouped
    }, [favouriteVideos])

    const visibleVideosByPosition = useMemo(() => {
        if (!hideCompleted) return videosByPosition

        const grouped = new Map<string, any[]>()

        // When enabled, only keep videos that are not complete for the current user.
        for (const [positionId, videos] of videosByPosition.entries()) {
            grouped.set(
                positionId,
                videos.filter((video: any) => !video?.id || !completedVideoIdSet.has(video.id))
            )
        }

        return grouped
    }, [videosByPosition, hideCompleted, completedVideoIdSet])

    const roadmapPositions = useMemo(() => {
        if (showEmptyPositions) return positions
        return positions.filter((position: any) => (visibleVideosByPosition.get(position.id)?.length ?? 0) > 0)
    }, [positions, visibleVideosByPosition, showEmptyPositions])

    const estimatedSurfaceHeight = useMemo(() => {
        const rowHeight = VIDEO_H + VIDEO_MARGIN * 2
        const baseHeight = 180
        // Keep a stable canvas height across filter toggles to avoid viewport jumps.
        return Math.max(baseHeight, positions.length * (rowHeight + ROW_GAP) + 96)
    }, [positions.length])

    // Sync ref so the pan-responder (stale closure) can read the latest height.
    useEffect(() => {
        surfaceHeightRef.current = estimatedSurfaceHeight
    }, [estimatedSurfaceHeight])

    const defaultPanX = useMemo(
        // Compensate for initial zoom so the left column stays visible on first render.
        () => ((SURFACE_WIDTH * (1 - DEFAULT_SCALE)) / 2) * DEFAULT_PAN_COMPENSATION_RATIO + DEFAULT_VIEWPORT_MARGIN_LEFT,
        []
    )
    const defaultPanY = useMemo(
        () => DEFAULT_VIEWPORT_MARGIN_TOP,
        []
    )

    const [selectedPos, setSelectedPos] = useState<any | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<{ pos: any; index: number; video: any } | null>(null)

    const onNodePress = useCallback((position: any) => {
        setSelectedPos(position)
    }, [])

    const onEmptyPositionPress = useCallback((position: any) => {
        if (!position?.id) return

        // Pass the position context so Library can preselect it on entry.
        router.push({
            pathname: '/library',
            params: {
                positionId: String(position.id),
                positionName: String(position.name || position.title || 'Position'),
            },
        })
    }, [])

    const onVideoPress = useCallback((position: any, index: number, video: any) => {
        setSelectedVideo({ pos: position, index, video })
    }, [])

    useEffect(() => {
        pan.setValue({ x: defaultPanX, y: defaultPanY })
        scale.setValue(DEFAULT_SCALE)
        lastPan.current = { x: defaultPanX, y: defaultPanY }
        lastScale.current = DEFAULT_SCALE
    }, [defaultPanX, defaultPanY, pan, scale])

    const PositionVideoStack: React.FC<{ pos: any; videos: any[]; showEmptyState: boolean }> = ({ pos, videos, showEmptyState }) => {
        if (videos.length === 0 && !showEmptyState) return null

        return (
            <View style={styles.videoRow}>
                {videos.length === 0 && showEmptyState && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onEmptyPositionPress(pos)}
                        style={[
                            styles.leafBox,
                            styles.emptyLeafBox,
                            {
                                width: VIDEO_W,
                                height: VIDEO_H,
                                marginVertical: VIDEO_MARGIN / 2,
                                paddingHorizontal: 8,
                            },
                        ]}
                    >
                        <View style={styles.emptyLeafActionWrap}>
                            <Ionicons name="add-circle-outline" size={42} color="#64748b" />
                            <ThemedText variant="small" style={styles.emptyLeafText}>No favourites yet</ThemedText>
                        </View>
                    </TouchableOpacity>
                )}
                {videos.map((video: any, index: number) => {
                    const key = video?.id ?? `${pos?.id}-fav-${index}`
                    const title = video?.title ?? `Video ${index + 1}`
                    // Completion is now driven by per-user DB rows instead of placeholder tile order.
                    const isComplete = !!video?.id && completedVideoIdSet.has(video.id)
                    const bgColor = isComplete ? '#16a34a' : '#94a3b8'
                    const tileImageSource = {
                        uri: video?.roadmap_preview_url ?? SAMPLE_PLACEHOLDER_URL,
                    }

                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => {
                                onVideoPress(pos, index, video)
                            }}
                            activeOpacity={0.85}
                        >
                            <View
                                style={[
                                    styles.leafBox,
                                    {
                                        width: VIDEO_W,
                                        height: VIDEO_H,
                                        marginVertical: VIDEO_MARGIN / 2,
                                        marginRight: VIDEO_GAP,
                                        paddingHorizontal: 8,
                                        paddingVertical: 8,
                                    },
                                ]}
                            >
                                <View style={styles.videoTileHeaderRow}>
                                    <ThemedText variant="small" style={{ ...styles.nodeText, ...styles.videoTitleText }} numberOfLines={1}>{title}</ThemedText>
                                    <Pressable
                                        onPress={(event) => {
                                            event.stopPropagation()
                                            if (!video?.id) return

                                            toggleCompletionWithFeedback(video.id, isComplete)
                                        }}
                                        disabled={!video?.id}
                                        hitSlop={8}
                                        style={{
                                            width: ICON_SIZE,
                                            height: ICON_SIZE,
                                            borderRadius: ICON_SIZE / 2,
                                            backgroundColor: bgColor,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginLeft: 6,
                                        }}
                                    >
                                        <ThemedText style={{ color: '#fff', fontSize: 12, lineHeight: 12 }}>✓</ThemedText>
                                    </Pressable>
                                </View>
                                <ExpoImage
                                    source={tileImageSource}
                                    style={styles.videoGif}
                                    contentFit="cover"
                                />
                                <ThemedText variant="small" style={styles.zoomHintText}>Tap to preview</ThemedText>
                            </View>
                        </TouchableOpacity>
                    )
                })}
            </View>
        )
    }

    const closeModal = useCallback(() => setSelectedPos(null), [])
    const closeVideoModal = useCallback(() => setSelectedVideo(null), [])
    const selectedVideoIsFavourite = !!selectedVideo?.video?.id && favouriteIdSet.has(selectedVideo.video.id)
    const selectedVideoIsDecked = !!selectedVideo?.video?.id && deckIdSet.has(selectedVideo.video.id)
    const selectedVideoIsComplete = !!selectedVideo?.video?.id && completedVideoIdSet.has(selectedVideo.video.id)
    const videoNavColor = mode === 'dark' ? colors.primary : '#111827'

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={styles.headerRow}>
                <ThemedText variant="title" style={styles.headerTitle}>Your Roadmap</ThemedText>
                <View style={styles.toggleRow}>
                    <ThemedText variant="small" style={styles.toggleText}>Show empty positions</ThemedText>
                    <Switch
                        value={showEmptyPositions}
                        onValueChange={setShowEmptyPositions}
                        trackColor={{ false: '#cbd5e1', true: colors.primary }}
                        thumbColor="#ffffff"
                    />
                </View>
                <View style={styles.toggleRow}>
                    <ThemedText variant="small" style={styles.toggleText}>Hide completed</ThemedText>
                    <Switch
                        value={hideCompleted}
                        onValueChange={setHideCompleted}
                        trackColor={{ false: '#cbd5e1', true: colors.primary }}
                        thumbColor="#ffffff"
                    />
                </View>
            </View>
            <View ref={canvasRef} onLayout={onCanvasLayout} style={styles.canvasOuter} {...panResponder.panHandlers}>
                <Animated.View
                    style={[
                        styles.canvasInner,
                        { width: SURFACE_WIDTH, minHeight: estimatedSurfaceHeight },
                        {
                            transform: [
                                { translateX: pan.x },
                                { translateY: pan.y },
                                { scale },
                            ],
                        },
                    ]}
                >
                    <View style={[styles.surface, { minHeight: estimatedSurfaceHeight }]}>
                        <View style={styles.surfaceHeaderRow}>
                            <View style={[styles.rootBox, styles.rootBoxStatic]}>
                                <ThemedText variant="subheader" style={styles.rootText}>Positions</ThemedText>
                            </View>
                            <View style={styles.selectedVideosHeader}>
                                <ThemedText variant="subheader" style={styles.selectedVideosHeaderText}>Chosen videos</ThemedText>
                            </View>
                        </View>

                        {roadmapPositions.map((position: any) => {
                            const positionFavouriteVideos = visibleVideosByPosition.get(position.id) ?? []

                            return (
                                <View key={position.id} style={styles.roadmapRow}>
                                    <View style={styles.positionColumn}>
                                        <TouchableOpacity onPress={() => onNodePress(position)} activeOpacity={0.85}>
                                            <View
                                                style={[
                                                    styles.positionBox,
                                                    styles.positionBoxStatic,
                                                    {
                                                        width: POSITION_COLUMN_WIDTH,
                                                    },
                                                ]}
                                            >
                                                <ThemedText
                                                    variant="small"
                                                    style={{ ...styles.nodeText, ...styles.positionTitleText }}
                                                    numberOfLines={1}
                                                >
                                                    {position.name || position.title || 'Position'}
                                                </ThemedText>
                                                <ExpoImage
                                                    source={{ uri: position?.roadmap_preview_url ?? SAMPLE_POSITION_PLACEHOLDER_URL }}
                                                    style={styles.positionPlaceholderImage}
                                                    contentFit="cover"
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.connectorStub} />

                                    <View style={styles.videosColumn}>
                                        <PositionVideoStack
                                            pos={position}
                                            videos={positionFavouriteVideos}
                                            showEmptyState={showEmptyPositions}
                                        />
                                    </View>
                                </View>
                            )
                        })}

                        {roadmapPositions.length === 0 && (
                            <View style={styles.emptyRoadmapState}>
                                <ThemedText variant="subheader" style={styles.emptyRoadmapTitle}>No roadmap items yet</ThemedText>
                                <ThemedText variant="small" style={styles.emptyRoadmapText}>Favourite videos to build your roadmap, or turn on "Show empty positions" to inspect gaps.</ThemedText>
                            </View>
                        )}
                    </View>

                    <Modal visible={selectedPos != null} transparent animationType="fade" onRequestClose={closeModal}>
                        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
                            <View style={[styles.modalContainer, { backgroundColor: mode === 'dark' ? colors.card : styles.modalContainer.backgroundColor }]}>
                                <ThemedText
                                    variant="title"
                                    style={{ ...(styles.modalTitleText as any), marginBottom: 8, color: mode === 'dark' ? colors.title : styles.modalTitleText.color }}
                                >
                                    {selectedPos?.name || selectedPos?.title || 'Position'}
                                </ThemedText>
                                <ThemedText
                                    variant="subheader"
                                    style={{ ...(styles.modalBodyText as any), marginBottom: 16, color: mode === 'dark' ? colors.text : styles.modalBodyText.color }}
                                >
                                    {selectedPos?.description || 'No description available.'}
                                </ThemedText>
                                <TouchableOpacity
                                    onPress={closeModal}
                                    style={[styles.modalCloseBtn, { backgroundColor: mode === 'dark' ? colors.primary : styles.modalCloseBtn.backgroundColor }]}
                                >
                                    <ThemedText style={{ color: '#fff' }}>Close</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Modal>

                    <Modal visible={selectedVideo != null} transparent animationType="fade" onRequestClose={closeVideoModal}>
                        <Pressable style={styles.modalBackdrop} onPress={closeVideoModal}>
                            <View style={[styles.modalContainer, { backgroundColor: mode === 'dark' ? colors.card : styles.modalContainer.backgroundColor }]}>
                                <Pressable
                                    onPress={closeVideoModal}
                                    hitSlop={8}
                                    style={styles.modalDismissIcon}
                                >
                                    <Ionicons name="close-circle" size={22} color={mode === 'dark' ? colors.text : '#111827'} />
                                </Pressable>
                                <ThemedText
                                    variant="title"
                                    style={{ ...(styles.modalTitleText as any), marginBottom: 8, color: mode === 'dark' ? colors.title : styles.modalTitleText.color }}
                                >
                                    {selectedVideo?.video?.title || (selectedVideo ? `Video ${selectedVideo.index + 1}` : '')}
                                </ThemedText>
                                <ThemedText
                                    variant="subheader"
                                    style={{
                                        ...(styles.modalBodyText as any),
                                        ...(styles.modalPositionText as any),
                                        marginBottom: 16,
                                        color: mode === 'dark' ? colors.text : styles.modalBodyText.color,
                                    }}
                                >
                                    {selectedVideo?.pos?.name || 'No position'}
                                </ThemedText>
                                <ExpoImage
                                    source={{ uri: selectedVideo?.video?.roadmap_gif_url ?? SAMPLE_GIF_URL }}
                                    style={styles.modalGifPreview}
                                    contentFit="cover"
                                    autoplay
                                />
                                <View style={styles.modalActionRow}>
                                    <View style={styles.modalActionGroup}>
                                        <ThemedLike
                                            liked={selectedVideoIsFavourite}
                                            size={22}
                                            onPress={() => {
                                                if (!selectedVideo?.video?.id || isFavouritePending) return
                                                toggleFavouriteWithFeedback(selectedVideo.video.id)
                                            }}
                                        />
                                        <ThemedStar
                                            starred={selectedVideoIsDecked}
                                            size={22}
                                            onPress={() => {
                                                if (!selectedVideo?.video?.id || isDeckPending) return
                                                toggleDeckWithFeedback(selectedVideo.video.id)
                                            }}
                                        />
                                        <Pressable
                                            onPress={() => {
                                                if (!selectedVideo?.video?.id || isCompletionPending) return
                                                toggleCompletionWithFeedback(selectedVideo.video.id, selectedVideoIsComplete)
                                            }}
                                            disabled={!selectedVideo?.video?.id || isCompletionPending}
                                            hitSlop={8}
                                            style={[
                                                styles.modalCompletionIcon,
                                                {
                                                    backgroundColor: selectedVideoIsComplete ? '#16a34a' : '#94a3b8',
                                                    opacity: (!selectedVideo?.video?.id || isCompletionPending) ? 0.6 : 1,
                                                },
                                            ]}
                                        >
                                            <ThemedText style={styles.modalCompletionText}>✓</ThemedText>
                                        </Pressable>
                                    </View>
                                    <Pressable
                                        onPress={() => {
                                            if (selectedVideo?.video?.id) {
                                                router.push(`/video/${selectedVideo.video.id}`)
                                                closeVideoModal()
                                            }
                                        }}
                                        disabled={!selectedVideo?.video?.id}
                                        hitSlop={8}
                                        style={[
                                            styles.modalVideoLink,
                                            { opacity: selectedVideo?.video?.id ? 1 : 0.6 },
                                        ]}
                                    >
                                        <Ionicons name="videocam" size={22} color={videoNavColor} />
                                    </Pressable>
                                </View>
                            </View>
                        </Pressable>
                    </Modal>
                </Animated.View>
            </View>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    headerRow: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
    },
    headerTitle: {
        marginBottom: 8,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleText: {
        color: '#475569',
        fontWeight: '600',
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    canvasOuter: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    canvasInner: {
        alignSelf: 'flex-start',
    },
    surface: {
        width: SURFACE_WIDTH,
        backgroundColor: 'transparent',
        paddingHorizontal: SURFACE_HORIZONTAL_PADDING,
        paddingBottom: 48,
    },
    nodeText: {
        color: '#0f172a',
        fontWeight: '600',
    },
    surfaceHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    rootBox: {
        borderRadius: 6,
        backgroundColor: '#e6dfd6',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        paddingHorizontal: 18,
        paddingVertical: 16,
    },
    rootBoxStatic: {
        width: POSITION_COLUMN_WIDTH,
    },
    rootText: {
        color: '#111827',
        fontWeight: '700',
    },
    selectedVideosHeader: {
        marginLeft: 34,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    selectedVideosHeaderText: {
        color: '#475569',
        fontWeight: '700',
    },
    roadmapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ROW_GAP,
    },
    positionColumn: {
        width: POSITION_COLUMN_WIDTH,
    },
    connectorStub: {
        width: 22,
        height: 2,
        marginHorizontal: 12,
        backgroundColor: '#cbd5e1',
    },
    videosColumn: {
        flex: 1,
    },
    videoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    leafBox: {
        backgroundColor: '#f2f7e7',
        borderRadius: 6,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        elevation: 1,
    },
    videoTileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    videoTitleText: {
        flex: 1,
        fontWeight: '700',
    },
    videoGif: {
        width: '100%',
        height: VIDEO_GIF_HEIGHT,
        borderRadius: 6,
        backgroundColor: '#dbe4ee',
    },
    zoomHintText: {
        marginTop: 4,
        textAlign: 'center',
        color: '#64748b',
        fontSize: 10,
    },
    emptyLeafBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#94a3b8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyLeafActionWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLeafText: {
        marginTop: 6,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '600',
    },
    positionBox: {
        backgroundColor: '#fff7f9',
        borderRadius: 8,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
    },
    positionBoxStatic: {
        height: POSITION_BOX_MIN_HEIGHT,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    positionTitleText: {
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'left',
    },
    positionPlaceholderImage: {
        width: '100%',
        height: VIDEO_GIF_HEIGHT,
        borderRadius: 6,
        backgroundColor: '#fde68a',
    },
    emptyRoadmapState: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
    },
    emptyRoadmapTitle: {
        marginBottom: 8,
        color: '#0f172a',
        fontWeight: '700',
    },
    emptyRoadmapText: {
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 420,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: 320,
        padding: 20,
        backgroundColor: '#f7fafc',
        borderRadius: 12,
        alignItems: 'center',
        position: 'relative',
    },
    modalCloseBtn: {
        marginTop: 8,
        backgroundColor: '#111827',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    modalTitleText: {
        color: '#0f172a',
        fontWeight: '700',
    },
    modalBodyText: {
        color: '#0f172a',
    },
    modalPositionText: {
        width: '100%',
        textAlign: 'left',
    },
    modalDismissIcon: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
    },
    modalActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 4,
    },
    modalActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    modalCompletionIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalVideoLink: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 24,
        minHeight: 24,
    },
    modalCompletionText: {
        color: '#fff',
        fontSize: 12,
        lineHeight: 12,
    },
    modalGifPreview: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginBottom: 12,
        backgroundColor: '#dbe4ee',
    },
})

export default YourRoadmap
