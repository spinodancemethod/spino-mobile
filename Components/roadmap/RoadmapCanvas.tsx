import React, { useCallback, useMemo, useRef } from 'react'
import { LayoutChangeEvent, Pressable, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { Image as ExpoImage } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import ThemedText from 'Components/ThemedText'
import { RoadmapPosition, RoadmapVideo } from './types'

type RoadmapCanvasProps = {
    styles: any;
    onSurfaceLayout?: (_event: LayoutChangeEvent) => void;
    /** Pan + pinch for the whole surface (useRoadmapGestures). */
    canvasGesture: GestureType | ReturnType<typeof Gesture.Simultaneous>;
    surfaceStyle: ReturnType<typeof useAnimatedStyle>;
    /** Current zoom, so tile drags can convert finger pixels into surface units. */
    scale: SharedValue<number>;
    /** Vertical gap between rows (marginBottom of styles.roadmapRow). */
    rowGap: number;
    /** Long-press drag of a video tile within its row. */
    onReorderVideos?: (positionId: string, fromIndex: number, toIndex: number) => void;
    /** Long-press drag of a category tile: the whole row moves. */
    onReorderPositions?: (fromIndex: number, toIndex: number) => void;
    surfaceWidth: number;
    estimatedSurfaceHeight: number;
    positionColumnWidth: number;
    videoWidth: number;
    videoHeight: number;
    videoMargin: number;
    videoGap: number;
    iconSize: number;
    roadmapPositions: RoadmapPosition[];
    roadmapVideosByPosition: Map<string, RoadmapVideo[]>;
    roadmapPositionVideosByPosition: Map<string, RoadmapVideo[]>;
    freeTierVideosByPosition: Map<string, RoadmapVideo[]>;
    availableVideosByPosition: Map<string, RoadmapVideo[]>;
    completedVideoIdSet: Set<string>;
    isSubscribed: boolean;
    showEmptyPositions: boolean;
    sampleVideoPlaceholderUrl: string;
    onNodePress: (position: RoadmapPosition) => void;
    onEmptyPositionPress: (position: RoadmapPosition) => void;
    onEmptyPositionVideoPress: (position: RoadmapPosition) => void;
    onVideoPress: (position: RoadmapPosition, index: number, video: RoadmapVideo) => void;
    onLockedPositionPress: (position: RoadmapPosition) => void;
    onToggleCompletion: (videoId: string, isComplete: boolean) => void;
    showLeftLane?: boolean;
    showConnectorStubs?: boolean;
    leftHeaderText?: string;
    centerHeaderText?: string;
    rightHeaderText?: string;
    showCenterAddButton?: boolean;
    onCenterAddPress?: () => void;
    showPositionDescription?: boolean;
}

/**
 * Reorder-by-drag state shared by every tile on the surface. Everything lives on
 * the UI thread: tiles read it in useAnimatedStyle, gestures write it in worklets.
 * kind: 0 idle, 1 video tile moving inside its row, 2 category row moving.
 *
 * Slot model: React children are rendered in a FIXED order (sorted by id) and the
 * visible order is expressed only as a transform, (slot - domIndex) * step. A drop
 * therefore never changes layout: the gesture parks the tiles in their new slots on
 * the UI thread, the data update later sets slot values that are already identical,
 * and the drag state is reset in the same JS tick as those slot writes. There is no
 * frame in which native layout and Reanimated transforms can disagree, which was the
 * source of every flicker variant before this (the canvas takes ~500 ms to re-render
 * in dev mode, so any approach that depended on commit timing showed it).
 * Tile sizes are fixed, so a drop target is plain arithmetic on the finger offset
 * divided by the zoom; no layout measurement is needed inside the scaled surface.
 */
type DragState = {
    kind: SharedValue<number>;
    /** Position id of the row whose tiles are being reordered (kind 1). */
    row: SharedValue<string>;
    from: SharedValue<number>;
    to: SharedValue<number>;
    dx: SharedValue<number>;
    dy: SharedValue<number>;
    /** 1 between a drop that changed the order and the data update that reflects it. */
    settling: SharedValue<number>;
    scale: SharedValue<number>;
    tileStep: number;
    rowStep: number;
}

const LONG_PRESS_MS = 220
const EMPTY_VIDEOS: RoadmapVideo[] = []
const SHIFT_MS = 120

function clampIndex(value: number, max: number) {
    'worklet'
    return Math.max(0, Math.min(max, value))
}

/** Where a tile currently in `slot` is shown while `from` is being dragged to `to`. */
function displaySlot(slot: number, from: number, to: number) {
    'worklet'
    if (slot === from) return to
    if (from < slot && slot <= to) return slot - 1
    if (to <= slot && slot < from) return slot + 1
    return slot
}

function resetDrag(drag: DragState) {
    'worklet'
    drag.kind.value = 0; drag.row.value = ''; drag.from.value = -1; drag.to.value = -1
    drag.dx.value = 0; drag.dy.value = 0; drag.settling.value = 0
}

function DraggableTile({ drag, rowId, domIndex, slot, count, onDrop, children }: {
    drag: DragState; rowId: string; domIndex: number; slot: number; count: number;
    onDrop?: (from: number, to: number) => void; children: React.ReactNode;
}) {
    const slotSV = useSharedValue(slot)
    React.useEffect(() => { slotSV.value = slot }, [slot, slotSV])
    // Memoised: a new gesture object per render makes GestureDetector reconfigure the
    // native handler, and with ~40 tiles that is expensive.
    const gesture = useMemo(() => Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .enabled(!!onDrop)
        .onStart(() => {
            drag.kind.value = 1; drag.row.value = rowId; drag.from.value = slot; drag.to.value = slot
            drag.dx.value = 0; drag.dy.value = 0; drag.settling.value = 0
        })
        .onUpdate((e) => {
            const dx = e.translationX / drag.scale.value
            drag.dx.value = dx
            drag.dy.value = e.translationY / drag.scale.value
            drag.to.value = clampIndex(Math.round(slot + dx / drag.tileStep), count - 1)
        })
        .onEnd(() => {
            const to = drag.to.value
            if (to !== slot && onDrop) {
                drag.settling.value = 1   // park everything in its new slot until the data catches up
                runOnJS(onDrop)(slot, to)
            }
        })
        .onFinalize(() => {
            if (drag.settling.value === 0) resetDrag(drag)
        }), [drag, rowId, slot, count, onDrop])
    const style = useAnimatedStyle(() => {
        const s = slotSV.value
        const mine = drag.kind.value === 1 && drag.row.value === rowId
        const base = (s - domIndex) * drag.tileStep
        if (mine && drag.settling.value === 0 && drag.from.value === s) {
            // Under the finger.
            return { zIndex: 10, opacity: 0.92, transform: [{ translateX: base + drag.dx.value }, { translateY: drag.dy.value }, { scale: 1.05 }] }
        }
        const shown = mine ? displaySlot(s, drag.from.value, drag.to.value) : s
        const x = (shown - domIndex) * drag.tileStep
        return { zIndex: 0, opacity: 1, transform: [{ translateX: mine ? withTiming(x, { duration: SHIFT_MS }) : x }, { translateY: 0 }, { scale: 1 }] }
    })
    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={style}>{children}</Animated.View>
        </GestureDetector>
    )
}

function DraggableRow({ drag, domIndex, slot, style: rowStyle, children }: { drag: DragState; domIndex: number; slot: number; style: any; children: React.ReactNode }) {
    const slotSV = useSharedValue(slot)
    React.useEffect(() => { slotSV.value = slot }, [slot, slotSV])
    const style = useAnimatedStyle(() => {
        const s = slotSV.value
        const mine = drag.kind.value === 2
        const base = (s - domIndex) * drag.rowStep
        if (mine && drag.settling.value === 0 && drag.from.value === s) {
            return { zIndex: 10, transform: [{ translateY: base + drag.dy.value }] }
        }
        const shown = mine ? displaySlot(s, drag.from.value, drag.to.value) : s
        const y = (shown - domIndex) * drag.rowStep
        return { zIndex: 0, transform: [{ translateY: mine ? withTiming(y, { duration: SHIFT_MS }) : y }] }
    })
    return <Animated.View style={[rowStyle, style]}>{children}</Animated.View>
}

/** The category tile is the handle for moving its whole row. */
function RowHandle({ drag, slot, count, onDrop, children }: {
    drag: DragState; slot: number; count: number; onDrop?: (from: number, to: number) => void; children: React.ReactNode;
}) {
    const gesture = useMemo(() => Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .enabled(!!onDrop)
        .onStart(() => {
            drag.kind.value = 2; drag.row.value = ''; drag.from.value = slot; drag.to.value = slot
            drag.dx.value = 0; drag.dy.value = 0; drag.settling.value = 0
        })
        .onUpdate((e) => {
            const dy = e.translationY / drag.scale.value
            drag.dy.value = dy
            drag.to.value = clampIndex(Math.round(slot + dy / drag.rowStep), count - 1)
        })
        .onEnd(() => {
            const to = drag.to.value
            if (to !== slot && onDrop) {
                drag.settling.value = 1
                runOnJS(onDrop)(slot, to)
            }
        })
        .onFinalize(() => {
            if (drag.settling.value === 0) resetDrag(drag)
        }), [drag, slot, count, onDrop])
    const style = useAnimatedStyle(() => ({
        transform: [{ scale: drag.kind.value === 2 && drag.settling.value === 0 && drag.from.value === slot ? 1.04 : 1 }],
    }))
    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={style}>{children}</Animated.View>
        </GestureDetector>
    )
}

/**
 * Everything the row strips need from the canvas. They are module-level components
 * on purpose: defined inside the canvas render they would be a new component type on
 * every render, and React would unmount and remount every tile (images included) each
 * time the canvas re-rendered, e.g. on a drop. That showed as tiles vanishing briefly.
 */
type StackContext = {
    styles: any;
    videoWidth: number; videoHeight: number; videoMargin: number; videoGap: number; iconSize: number;
    freeTierVideosByPosition: Map<string, RoadmapVideo[]>;
    availableVideosByPosition: Map<string, RoadmapVideo[]>;
    completedVideoIdSet: Set<string>;
    isSubscribed: boolean;
    sampleVideoPlaceholderUrl: string;
    onEmptyPositionPress: (position: RoadmapPosition) => void;
    onEmptyPositionVideoPress: (position: RoadmapPosition) => void;
    onVideoPress: (position: RoadmapPosition, index: number, video: RoadmapVideo) => void;
    onLockedPositionPress: (position: RoadmapPosition) => void;
    onToggleCompletion: (videoId: string, isComplete: boolean) => void;
    onReorderVideos?: (positionId: string, fromIndex: number, toIndex: number) => void;
    drag: DragState;
    dropVideo: (positionId: string, from: number, to: number) => void;
}

// `completedVideoIdSet` is passed as a prop (not only via ctxRef) so these memoised stacks
// re-render when completion state changes; a ref update alone would not trigger a render.
const PositionVideoStack = React.memo(function PositionVideoStack({ ctxRef, pos, videos, showEmptyState, completedVideoIdSet }: { ctxRef: React.RefObject<StackContext>; pos: RoadmapPosition; videos: RoadmapVideo[]; showEmptyState: boolean; completedVideoIdSet: Set<string> }) {
    const ctx = ctxRef.current!
    const { styles, videoWidth, videoHeight, videoMargin, videoGap, iconSize, freeTierVideosByPosition, availableVideosByPosition, isSubscribed, sampleVideoPlaceholderUrl, onReorderVideos, drag } = ctx
    // Fixed DOM order (by key); the data order is carried by `slot` (see DragState).
    const domOrder = useMemo(() => videos
        .map((video, slot) => ({ video, slot, key: video?.id ?? `${pos?.id}-fav-${slot}` }))
        .sort((a, b) => a.key.localeCompare(b.key)), [videos, pos?.id])
    const hasVisibleFreeVideos = (freeTierVideosByPosition.get(pos?.id)?.length ?? 0) > 0
    const hasRoadmapVideos = videos.length > 0
    const hasVisibleVideos = (availableVideosByPosition.get(pos?.id)?.length ?? 0) > 0

    const shouldShowNoFavouritesTile = !isSubscribed && !hasRoadmapVideos && hasVisibleFreeVideos
    const shouldShowSubscribeTile = !isSubscribed && !hasVisibleFreeVideos && !hasRoadmapVideos
    // Subscribed: always show the + so they can add any video to chosen moves.
    // Not subscribed: keep existing logic (free-tier tiles, subscribe prompt, etc.)
    const shouldShowAddTile = isSubscribed ? (!hasRoadmapVideos) : (!hasRoadmapVideos && (showEmptyState || hasVisibleVideos))
    const shouldShowAddButton = !shouldShowSubscribeTile && (hasRoadmapVideos || shouldShowAddTile || shouldShowNoFavouritesTile)

    if (videos.length === 0 && !shouldShowAddButton && !shouldShowSubscribeTile) {
        return null
    }

    const addButton = (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => ctxRef.current!.onEmptyPositionPress(pos)}
            style={[
                styles.emptyLeafButtonSlot,
                {
                    // Match the left-lane + button width so both add icons have the same slot size.
                    width: 54,
                    height: videoHeight,
                    marginVertical: videoMargin / 2,
                    marginRight: videoGap,
                },
            ]}
        >
            {/* Keep the action centered in the row without rendering a full placeholder tile. */}
            <View style={styles.emptyLeafButton}>
                <Ionicons name="add" size={26} color="#ffffff" />
            </View>
        </TouchableOpacity>
    )

    return (
        <View style={styles.videoRow}>
            {!hasRoadmapVideos && shouldShowAddButton && addButton}

            {shouldShowSubscribeTile && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => ctxRef.current!.onLockedPositionPress(pos)}
                    style={[
                        styles.leafBox,
                        styles.lockedLeafBox,
                        {
                            width: videoWidth,
                            height: videoHeight,
                            marginVertical: videoMargin / 2,
                            marginRight: videoGap,
                            paddingHorizontal: 8,
                        },
                    ]}
                >
                    <View style={styles.emptyLeafActionWrap}>
                        <Ionicons name="lock-closed-outline" size={40} color="#6b7280" />
                        <ThemedText variant="small" style={styles.emptyLeafText}>Subscribe to unlock</ThemedText>
                    </View>
                </TouchableOpacity>
            )}

            {domOrder.map(({ video, slot: index, key }, domIndex) => {
                const title = video?.title ?? `Video ${index + 1}`
                const isComplete = !!video?.id && completedVideoIdSet.has(video.id)
                const bgColor = isComplete ? '#16a34a' : '#94a3b8'

                return (
                    <DraggableTile
                        key={key}
                        drag={drag}
                        rowId={pos.id}
                        domIndex={domIndex}
                        slot={index}
                        count={videos.length}
                        onDrop={onReorderVideos ? (from, to) => ctxRef.current!.dropVideo(pos.id, from, to) : undefined}
                    >
                    <TouchableOpacity
                        onPress={() => ctxRef.current!.onVideoPress(pos, index, video)}
                        activeOpacity={0.85}
                    >
                        <View
                            style={[
                                styles.leafBox,
                                {
                                    width: videoWidth,
                                    height: videoHeight,
                                    marginVertical: videoMargin / 2,
                                    marginRight: videoGap,
                                    paddingHorizontal: 8,
                                    paddingVertical: 8,
                                    backgroundColor: '#f2f7e7',
                                },
                            ]}
                        >
                            <View style={styles.videoTileHeaderRow}>
                                <ThemedText variant="small" style={{ ...styles.nodeText, ...styles.videoTitleText }} numberOfLines={1}>{title}</ThemedText>
                                <Pressable
                                    onPress={(event) => {
                                        event.stopPropagation()
                                        if (!video?.id) return
                                        ctxRef.current!.onToggleCompletion(video.id, isComplete)
                                    }}
                                    disabled={!video?.id}
                                    hitSlop={8}
                                    style={{
                                        width: iconSize,
                                        height: iconSize,
                                        borderRadius: iconSize / 2,
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
                                source={{ uri: video?.thumbnail_url ?? sampleVideoPlaceholderUrl }}
                                style={styles.videoGif}
                                contentFit="cover"
                                autoplay={false}
                            />
                            {video?.note_text ? (
                                <ThemedText
                                    variant="small"
                                    style={styles.videoNoteText}
                                    numberOfLines={2}
                                >
                                    {video.note_text}
                                </ThemedText>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                    </DraggableTile>
                )
            })}

            {hasRoadmapVideos && shouldShowAddButton && addButton}
        </View>
    )
})

const PositionEntryStack = React.memo(function PositionEntryStack({ ctxRef, pos, videos, showAddButton, completedVideoIdSet }: { ctxRef: React.RefObject<StackContext>; pos: RoadmapPosition; videos: RoadmapVideo[]; showAddButton: boolean; completedVideoIdSet: Set<string> }) {
    const ctx = ctxRef.current!
    const { styles, videoWidth, videoHeight, videoMargin, videoGap, iconSize, sampleVideoPlaceholderUrl } = ctx
    if (videos.length === 0 && !showAddButton) {
        return null
    }

    return (
        <View style={styles.videoRow}>
            {showAddButton && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => ctxRef.current!.onEmptyPositionVideoPress(pos)}
                    style={[
                        styles.emptyLeafButtonSlot,
                        {
                            width: 54,
                            height: videoHeight,
                            marginVertical: videoMargin / 2,
                        },
                    ]}
                >
                    <View style={styles.emptyLeafButton}>
                        <Ionicons name="add" size={26} color="#ffffff" />
                    </View>
                </TouchableOpacity>
            )}

            {videos.map((video: RoadmapVideo, index: number) => {
                const key = video?.id ?? `${pos?.id}-position-${index}`
                const title = video?.title ?? `Position video ${index + 1}`
                const isComplete = !!video?.id && completedVideoIdSet.has(video.id)
                const bgColor = isComplete ? '#16a34a' : '#94a3b8'

                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => ctxRef.current!.onVideoPress(pos, index, video)}
                        activeOpacity={0.85}
                    >
                        <View
                            style={[
                                styles.leafBox,
                                {
                                    width: videoWidth,
                                    height: videoHeight,
                                    marginVertical: videoMargin / 2,
                                    // Keep a fixed gap between the inline + button and the first tile.
                                    marginLeft: videoGap,
                                    paddingHorizontal: 8,
                                    paddingVertical: 8,
                                    backgroundColor: '#eef6ff',
                                },
                            ]}
                        >
                            <View style={styles.videoTileHeaderRow}>
                                <ThemedText variant="small" style={{ ...styles.nodeText, ...styles.videoTitleText }} numberOfLines={1}>{title}</ThemedText>
                                <Pressable
                                    onPress={(event) => {
                                        event.stopPropagation()
                                        if (!video?.id) return
                                        ctxRef.current!.onToggleCompletion(video.id, isComplete)
                                    }}
                                    disabled={!video?.id}
                                    hitSlop={8}
                                    style={{
                                        width: iconSize,
                                        height: iconSize,
                                        borderRadius: iconSize / 2,
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
                                source={{ uri: video?.thumbnail_url ?? sampleVideoPlaceholderUrl }}
                                style={styles.videoGif}
                                contentFit="cover"
                                autoplay={false}
                            />
                            {video?.note_text ? (
                                <ThemedText
                                    variant="small"
                                    style={styles.videoNoteText}
                                    numberOfLines={2}
                                >
                                    {video.note_text}
                                </ThemedText>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
})

export function RoadmapCanvas({
    styles,
    onSurfaceLayout,
    canvasGesture,
    surfaceStyle,
    scale,
    rowGap,
    onReorderVideos,
    onReorderPositions,
    surfaceWidth,
    estimatedSurfaceHeight,
    positionColumnWidth,
    videoWidth,
    videoHeight,
    videoMargin,
    videoGap,
    iconSize,
    roadmapPositions,
    roadmapVideosByPosition,
    roadmapPositionVideosByPosition,
    freeTierVideosByPosition,
    availableVideosByPosition,
    completedVideoIdSet,
    isSubscribed,
    showEmptyPositions,
    sampleVideoPlaceholderUrl,
    onNodePress,
    onEmptyPositionPress,
    onEmptyPositionVideoPress,
    onVideoPress,
    onLockedPositionPress,
    onToggleCompletion,
    showLeftLane = true,
    showConnectorStubs = true,
    leftHeaderText = 'Getting to position',
    centerHeaderText = 'Positions',
    rightHeaderText = 'Chosen moves',
    showCenterAddButton = false,
    onCenterAddPress,
    showPositionDescription = false,
}: RoadmapCanvasProps) {
    const drag: DragState = {
        kind: useSharedValue(0), row: useSharedValue(''), from: useSharedValue(-1), to: useSharedValue(-1),
        dx: useSharedValue(0), dy: useSharedValue(0), settling: useSharedValue(0), scale,
        tileStep: videoWidth + videoGap,
        // Each row is one tile tall plus its vertical margins and the row gap.
        rowStep: videoHeight + videoMargin + rowGap,
    }

    const positions = roadmapPositions
    const videosFor = (positionId: string): RoadmapVideo[] => roadmapVideosByPosition.get(positionId) ?? EMPTY_VIDEOS
    const orderSignature = positions.map((p) => `${p.id}:${videosFor(p.id).map((v) => v.id).join(',')}`).join('|')
    React.useEffect(() => {
        // The order changed (normally the optimistic cache update after a drop). The tile
        // effects have just written their new slots in this same effects flush, and those
        // values equal the parked positions, so clearing the drag state here changes nothing
        // on screen. Reanimated batches the shared-value writes of one JS tick.
        if (drag.settling.value === 1) resetDrag(drag)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderSignature])

    // Fixed DOM order for rows too (by id); `slot` carries the data order.
    const rowDom = useMemo(() => positions
        .map((position, slot) => ({ position, slot }))
        .sort((a, b) => a.position.id.localeCompare(b.position.id)), [positions])

    // Stable drop handlers (latest callbacks via a ref) so memoised gestures are not
    // rebuilt on every render.
    const latest = useRef({ onReorderVideos, onReorderPositions })
    latest.current = { onReorderVideos, onReorderPositions }
    const settleGuard = useRef<ReturnType<typeof setTimeout> | null>(null)
    const armSettleGuard = () => {
        // If no data update ever arrives (save failed and was rolled back), snap back.
        if (settleGuard.current) clearTimeout(settleGuard.current)
        settleGuard.current = setTimeout(() => { if (drag.settling.value === 1) resetDrag(drag) }, 4000)
    }
    const dropVideo = useCallback((positionId: string, from: number, to: number) => {
        armSettleGuard()
        latest.current.onReorderVideos?.(positionId, from, to)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const dropRow = useCallback((from: number, to: number) => {
        armSettleGuard()
        latest.current.onReorderPositions?.(from, to)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const getCategoryPlaceholderUrl = (label: string) => {
        // Keep placeholder images meaningful when a custom preview thumbnail is missing.
        return `https://placehold.co/320x180/fef3c7/92400e?text=${encodeURIComponent(label)}`
    }

    const stackCtx: StackContext = {
        styles, videoWidth, videoHeight, videoMargin, videoGap, iconSize, freeTierVideosByPosition, availableVideosByPosition,
        completedVideoIdSet, isSubscribed, sampleVideoPlaceholderUrl, onEmptyPositionPress, onEmptyPositionVideoPress, onVideoPress,
        onLockedPositionPress, onToggleCompletion, onReorderVideos, drag, dropVideo,
    }
    const stackCtxRef = useRef(stackCtx)
    stackCtxRef.current = stackCtx

    return (
        <GestureDetector gesture={canvasGesture}>
        <View style={styles.canvasOuter}>
            <Animated.View
                onLayout={onSurfaceLayout}
                style={[
                    styles.canvasInner,
                    { width: surfaceWidth, minHeight: estimatedSurfaceHeight },
                    surfaceStyle,
                ]}
            >
                <View style={[styles.surface, { minHeight: estimatedSurfaceHeight }]}>
                    <View style={styles.surfaceHeaderRow}>
                        {showLeftLane ? (
                            <View style={styles.selectedVideosHeaderLeft}>
                                <ThemedText variant="subheader" style={styles.selectedVideosHeaderText}>{leftHeaderText}</ThemedText>
                            </View>
                        ) : null}
                        <View style={[styles.rootBox, styles.rootBoxStatic]}>
                            <ThemedText variant="subheader" style={styles.rootText}>{centerHeaderText}</ThemedText>
                        </View>
                        <View style={styles.selectedVideosHeaderRight}>
                            <ThemedText variant="subheader" style={styles.selectedVideosHeaderText}>{rightHeaderText}</ThemedText>
                        </View>
                    </View>

                    {rowDom.map(({ position, slot: rowIndex }, domIndex) => {
                        const positionRoadmapVideos = roadmapPositionVideosByPosition.get(position.id) ?? []
                        const positionFavouriteVideos = videosFor(position.id)
                        const positionAllowsVideos = position?.has_videos !== false
                        // Left lane ("Getting to position"): show + for everyone as long as
                        // the position record allows videos — subscription state is irrelevant here.
                        const shouldShowPositionAddButton = positionAllowsVideos

                        return (
                            <DraggableRow key={position.id} drag={drag} domIndex={domIndex} slot={rowIndex} style={styles.roadmapRow}>
                                {showLeftLane ? (
                                    <View style={styles.leftVideosColumn}>
                                        <PositionEntryStack
                                            ctxRef={stackCtxRef}
                                            pos={position}
                                            videos={positionRoadmapVideos}
                                            showAddButton={shouldShowPositionAddButton}
                                            completedVideoIdSet={completedVideoIdSet}
                                        />
                                    </View>
                                ) : null}

                                {showLeftLane && showConnectorStubs ? <View style={styles.connectorStub} /> : null}

                                <View style={styles.positionColumn}>
                                    <RowHandle drag={drag} slot={rowIndex} count={positions.length} onDrop={onReorderPositions ? dropRow : undefined}>
                                    <TouchableOpacity onPress={() => onNodePress(position)} activeOpacity={0.85}>
                                        <View
                                            style={[
                                                styles.positionBox,
                                                styles.positionBoxStatic,
                                                {
                                                    width: positionColumnWidth,
                                                    height: videoHeight,
                                                },
                                            ]}
                                        >
                                            <ThemedText
                                                variant="small"
                                                style={{ ...styles.nodeText, ...styles.positionTitleText }}
                                                numberOfLines={2}
                                            >
                                                {position.name || position.title || 'Position'}
                                            </ThemedText>
                                            <ExpoImage
                                                source={{
                                                    uri:
                                                        position?.roadmap_preview_url
                                                        ?? getCategoryPlaceholderUrl(position.name || position.title || 'Category'),
                                                }}
                                                style={styles.positionPlaceholderImage}
                                                contentFit="cover"
                                            />
                                            {showPositionDescription && position?.description ? (
                                                <ThemedText
                                                    variant="small"
                                                    style={{ ...styles.videoNoteText, ...styles.positionDescriptionText }}
                                                    numberOfLines={2}
                                                >
                                                    {position.description}
                                                </ThemedText>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                    </RowHandle>
                                </View>

                                {showConnectorStubs ? <View style={styles.connectorStub} /> : null}

                                <View style={styles.rightVideosColumn}>
                                    <PositionVideoStack
                                        ctxRef={stackCtxRef}
                                        pos={position}
                                        videos={positionFavouriteVideos}
                                        showEmptyState={showEmptyPositions}
                                        completedVideoIdSet={completedVideoIdSet}
                                    />
                                </View>
                            </DraggableRow>
                        )
                    })}

                    {roadmapPositions.length === 0 && (
                        <View style={styles.emptyRoadmapState}>
                            <ThemedText variant="subheader" style={styles.emptyRoadmapTitle}>No roadmap items yet</ThemedText>
                            <ThemedText variant="small" style={styles.emptyRoadmapText}>Add segments to build your roadmap, or turn on "Show empty categories" to inspect gaps.</ThemedText>
                        </View>
                    )}

                    {showCenterAddButton ? (
                        <View style={styles.roadmapRow}>
                            {showLeftLane ? <View style={styles.leftVideosColumn} /> : null}

                            <View style={styles.positionColumn}>
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => onCenterAddPress?.()}
                                    style={{ alignItems: 'center', paddingTop: 6 }}
                                >
                                    <View style={styles.emptyLeafButton}>
                                        <Ionicons name="add" size={24} color="#ffffff" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.rightVideosColumn} />
                        </View>
                    ) : null}
                </View>
            </Animated.View>
        </View>
        </GestureDetector>
    )
}
