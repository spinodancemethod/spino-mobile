import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { usePositions } from 'lib/hooks/usePositions'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useVideosByIds } from 'lib/hooks/useVideosByIds'
import { useVideoActionToggles } from 'lib/hooks/useVideoActionToggles'
import { useEntitlement } from 'lib/hooks/useEntitlement'
import { useFreeTierVideos } from 'lib/hooks/useFreeTierVideos'
import { useVisibleVideos } from 'lib/hooks/useVisibleVideos'
import { useRoadmapGestures } from 'lib/hooks/useRoadmapGestures'
import { useAuth } from 'lib/auth'
import { reportAppEvent } from 'lib/observability'
import { router } from 'expo-router'
import { useTheme } from 'constants/useTheme'
import { RoadmapCanvas } from './roadmap/RoadmapCanvas'
import { RoadmapModals } from './roadmap/RoadmapModals'
import { RoadmapPosition, RoadmapVideo, SelectedRoadmapVideo } from './roadmap/types'

// Scale bounds for pinch-to-zoom so users can inspect the roadmap comfortably.
const MIN_SCALE = 0.2
const MAX_SCALE = 3
const DEFAULT_SCALE = 0.5
const DEFAULT_VIEWPORT_MARGIN_LEFT = 16
// Lift the roadmap further on initial render so the header row starts nearer the top.
const DEFAULT_VIEWPORT_MARGIN_TOP = -700
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
    const { user } = useAuth()

    const { data: positionsData = [] } = usePositions(undefined)
    const { isSubscribed } = useEntitlement()
    const { data: favouriteIds = [] } = useFavouritesByUser()
    const { data: favouriteVideosData = [] } = useVideosByIds(favouriteIds)
    const { data: freeTierVideosData = [] } = useFreeTierVideos()
    const { data: visibleVideosData = [] } = useVisibleVideos()

    const positions = positionsData as RoadmapPosition[]
    const favouriteVideos = favouriteVideosData as RoadmapVideo[]
    const freeTierVideos = freeTierVideosData as RoadmapVideo[]
    const visibleVideos = visibleVideosData as RoadmapVideo[]

    const [showEmptyPositions, setShowEmptyPositions] = useState(false)
    const [hideCompleted, setHideCompleted] = useState(false)

    const {
        favouriteIdSet,
        completedVideoIdSet,
        isFavouritePending,
        isCompletionPending,
        toggleFavouriteWithFeedback,
        toggleCompletionWithFeedback,
    } = useVideoActionToggles()

    // Roadmap remains driven by user-selected favourites for both free and paid users.
    const roadmapSourceVideos = useMemo(
        () => favouriteVideos,
        [favouriteVideos]
    )

    const videosByPosition = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()

        for (const video of roadmapSourceVideos) {
            const positionId = video?.position_id
            if (!positionId) continue
            const current = grouped.get(positionId) ?? []
            current.push(video)
            grouped.set(positionId, current)
        }

        return grouped
    }, [roadmapSourceVideos])

    // All free-tier videos grouped by position, regardless of whether they are on roadmap.
    const freeTierVideosByPosition = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()

        for (const video of freeTierVideos) {
            const positionId = video?.position_id
            if (!positionId) continue

            const current = grouped.get(positionId) ?? []
            current.push(video)
            grouped.set(positionId, current)
        }

        return grouped
    }, [freeTierVideos])

    // Every currently visible video (respecting RLS) grouped by position.
    const availableVideosByPosition = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()

        for (const video of visibleVideos) {
            const positionId = video?.position_id
            if (!positionId) continue

            const current = grouped.get(positionId) ?? []
            current.push(video)
            grouped.set(positionId, current)
        }

        return grouped
    }, [visibleVideos])

    const roadmapVideosByPosition = useMemo(() => {
        if (!hideCompleted) return videosByPosition

        const grouped = new Map<string, RoadmapVideo[]>()

        // When enabled, only keep videos that are not complete for the current user.
        for (const [positionId, videos] of videosByPosition.entries()) {
            grouped.set(
                positionId,
                videos.filter((video: RoadmapVideo) => !video?.id || !completedVideoIdSet.has(video.id))
            )
        }

        return grouped
    }, [videosByPosition, hideCompleted, completedVideoIdSet])

    const roadmapPositions = useMemo(() => {
        // Toggle off: only positions with roadmap videos.
        // Toggle on: all currently available positions (RLS-filtered from backend).
        if (showEmptyPositions) return positions

        return positions.filter((position: RoadmapPosition) => (roadmapVideosByPosition.get(position.id)?.length ?? 0) > 0)
    }, [positions, roadmapVideosByPosition, showEmptyPositions])

    const estimatedSurfaceHeight = useMemo(() => {
        const rowHeight = VIDEO_H + VIDEO_MARGIN * 2
        const baseHeight = 180
        // Keep a stable canvas height across filter toggles to avoid viewport jumps.
        return Math.max(baseHeight, positions.length * (rowHeight + ROW_GAP) + 96)
    }, [positions.length])

    const defaultPanX = useMemo(
        // Compensate for initial zoom so the left column stays visible on first render.
        () => ((SURFACE_WIDTH * (1 - DEFAULT_SCALE)) / 2) * DEFAULT_PAN_COMPENSATION_RATIO + DEFAULT_VIEWPORT_MARGIN_LEFT,
        []
    )
    const defaultPanY = useMemo(
        () => DEFAULT_VIEWPORT_MARGIN_TOP,
        []
    )

    const {
        canvasRef,
        onCanvasLayout,
        pan,
        panHandlers,
        scale,
        setSurfaceHeight,
    } = useRoadmapGestures({
        minScale: MIN_SCALE,
        maxScale: MAX_SCALE,
        defaultScale: DEFAULT_SCALE,
        surfaceWidth: SURFACE_WIDTH,
        defaultPanX,
        defaultPanY,
    })

    // Keep gesture focal compensation synced with dynamic surface height.
    useEffect(() => {
        setSurfaceHeight(estimatedSurfaceHeight)
    }, [estimatedSurfaceHeight, setSurfaceHeight])

    const [selectedPos, setSelectedPos] = useState<RoadmapPosition | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<SelectedRoadmapVideo | null>(null)

    const onNodePress = useCallback((position: RoadmapPosition) => {
        setSelectedPos(position)
    }, [])

    const onEmptyPositionPress = useCallback((position: RoadmapPosition) => {
        if (!position?.id) return

        // Pass the position context so Library can preselect it on entry.
        router.push({
            pathname: '/(private)/(dashboard)/library',
            params: {
                positionId: String(position.id),
                positionName: String(position.name || position.title || 'Position'),
            },
        })
    }, [])

    const onVideoPress = useCallback((position: RoadmapPosition, index: number, video: RoadmapVideo) => {
        setSelectedVideo({ pos: position, index, video })
    }, [])

    const onLockedPositionPress = useCallback((position: RoadmapPosition) => {
        void reportAppEvent({
            event: 'locked_content_tap',
            userId: user?.id,
            metadata: {
                screen: 'your_roadmap',
                positionId: position?.id ?? null,
                videoId: null,
                reason: 'no_free_videos_for_position',
            },
        })

        router.push('/subscribe')
    }, [user?.id])

    const closeModal = useCallback(() => setSelectedPos(null), [])
    const closeVideoModal = useCallback(() => setSelectedVideo(null), [])

    const onOpenVideoFromModal = useCallback((videoId: string) => {
        router.push(`/video/${videoId}`)
        closeVideoModal()
    }, [closeVideoModal])

    const selectedVideoIsFavourite = !!selectedVideo?.video?.id && favouriteIdSet.has(selectedVideo.video.id)
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

            <RoadmapCanvas
                styles={styles}
                canvasRef={canvasRef}
                onCanvasLayout={onCanvasLayout}
                panHandlers={panHandlers}
                pan={pan}
                scale={scale}
                surfaceWidth={SURFACE_WIDTH}
                estimatedSurfaceHeight={estimatedSurfaceHeight}
                positionColumnWidth={POSITION_COLUMN_WIDTH}
                videoWidth={VIDEO_W}
                videoHeight={VIDEO_H}
                videoMargin={VIDEO_MARGIN}
                videoGap={VIDEO_GAP}
                iconSize={ICON_SIZE}
                roadmapPositions={roadmapPositions}
                roadmapVideosByPosition={roadmapVideosByPosition}
                freeTierVideosByPosition={freeTierVideosByPosition}
                availableVideosByPosition={availableVideosByPosition}
                completedVideoIdSet={completedVideoIdSet}
                isSubscribed={isSubscribed}
                showEmptyPositions={showEmptyPositions}
                samplePositionPlaceholderUrl={SAMPLE_POSITION_PLACEHOLDER_URL}
                sampleVideoPlaceholderUrl={SAMPLE_PLACEHOLDER_URL}
                onNodePress={onNodePress}
                onEmptyPositionPress={onEmptyPositionPress}
                onVideoPress={onVideoPress}
                onLockedPositionPress={onLockedPositionPress}
                onToggleCompletion={toggleCompletionWithFeedback}
            />

            <RoadmapModals
                styles={styles}
                mode={mode}
                colors={{
                    card: colors.card,
                    title: colors.title,
                    text: colors.text,
                    primary: colors.primary,
                }}
                selectedPos={selectedPos}
                selectedVideo={selectedVideo}
                selectedVideoIsFavourite={selectedVideoIsFavourite}
                selectedVideoIsComplete={selectedVideoIsComplete}
                isFavouritePending={isFavouritePending}
                isCompletionPending={isCompletionPending}
                videoNavColor={videoNavColor}
                sampleGifUrl={SAMPLE_GIF_URL}
                onClosePositionModal={closeModal}
                onCloseVideoModal={closeVideoModal}
                onToggleFavourite={toggleFavouriteWithFeedback}
                onToggleCompletion={toggleCompletionWithFeedback}
                onOpenVideo={onOpenVideoFromModal}
            />
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
    emptyLeafButtonSlot: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLeafButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#64748b',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    lockedLeafBox: {
        backgroundColor: '#e5e7eb',
        borderWidth: 1,
        borderColor: '#9ca3af',
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
