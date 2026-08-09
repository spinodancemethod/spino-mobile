import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Dimensions, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { RoadmapCanvas } from 'Components/roadmap/RoadmapCanvas'
import { RoadmapPosition, RoadmapVideo } from 'Components/roadmap/types'
import { styles } from './your-roadmap'
import { useRoadmapGestures } from 'lib/hooks/useRoadmapGestures'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useRoadmapSegments } from 'lib/hooks/useRoadmapSegments'
import { useTheme } from 'constants/useTheme'

const SURFACE_WIDTH = 1800
const VIDEO_W = 170
const VIDEO_H = 214
const VIDEO_MARGIN = 10
const VIDEO_GAP = 12
const POSITION_COLUMN_WIDTH = 180
const ICON_SIZE = 18
const ROW_GAP = 18
const DEFAULT_SCALE = 0.5
const INITIAL_VIEWPORT_WIDTH = Dimensions.get('window').width
const SAMPLE_PLACEHOLDER_URL = 'https://placehold.co/240x135/e2e8f0/475569?text=Local+Video'
const SAMPLE_POSITION_PLACEHOLDER_URL = 'https://placehold.co/320x180/fef3c7/92400e?text=Roadmap'

export default function UserRoadmapScreen() {
    const { colors } = useTheme()
    const { roadmapId } = useLocalSearchParams<{ roadmapId?: string }>()
    const roadmapsQuery = useUserRoadmaps()
    const roadmap = roadmapsQuery.data?.find((item) => item.id === roadmapId) ?? roadmapsQuery.data?.[0]
    const segmentsQuery = useRoadmapSegments(roadmap?.id)
    const roadmapPosition = useMemo<RoadmapPosition[]>(() => roadmap ? [{ id: roadmap.id, name: roadmap.name, description: roadmap.description }] : [], [roadmap])
    const roadmapVideos = useMemo<RoadmapVideo[]>(() => (segmentsQuery.data ?? []).map((segment) => ({
        id: segment.id,
        title: segment.title ?? segment.category_name,
        description: segment.description,
        thumbnail_url: segment.video_thumbnail,
        video_upload_id: segment.video_upload_id,
        start_time: segment.start_time,
        end_time: segment.end_time,
        category_name: segment.category_name,
    })), [segmentsQuery.data])
    const videosByRoadmap = useMemo(() => new Map(roadmap ? [[roadmap.id, roadmapVideos]] : []), [roadmap, roadmapVideos])
    const emptyVideos = useMemo(() => new Map<string, RoadmapVideo[]>(), [])
    const [surfaceHeight, setSurfaceHeight] = useState(500)
    const defaultPanX = (INITIAL_VIEWPORT_WIDTH / 2) - ((SURFACE_WIDTH / 2) * DEFAULT_SCALE)
    const { canvasRef, onCanvasLayout, pan, panHandlers, scale, setSurfaceHeight: setGestureSurfaceHeight } = useRoadmapGestures({
        minScale: 0.2,
        maxScale: 3,
        defaultScale: DEFAULT_SCALE,
        surfaceWidth: SURFACE_WIDTH,
        defaultPanX,
        defaultPanY: -300,
    })

    useEffect(() => {
        setGestureSurfaceHeight(surfaceHeight)
    }, [setGestureSurfaceHeight, surfaceHeight])

    if (roadmapsQuery.isLoading || segmentsQuery.isLoading) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><ThemedText variant="small">Loading roadmap...</ThemedText></ThemedView>
    }

    if (!roadmap) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><ThemedText variant="title">No roadmap selected</ThemedText><ThemedText variant="small">Return to Your Roadmaps and choose one to open.</ThemedText></ThemedView>
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ padding: 12 }}>
                <ThemedText variant="title">{roadmap.name}</ThemedText>
                <ThemedText variant="small">Your uploaded video references appear in this roadmap.</ThemedText>
            </View>
            <RoadmapCanvas
                styles={styles}
                canvasRef={canvasRef}
                onCanvasLayout={(event) => { onCanvasLayout(event); setSurfaceHeight(Math.max(500, event.nativeEvent.layout.height)) }}
                panHandlers={panHandlers}
                pan={pan}
                scale={scale}
                surfaceWidth={SURFACE_WIDTH}
                estimatedSurfaceHeight={Math.max(surfaceHeight, 500)}
                positionColumnWidth={POSITION_COLUMN_WIDTH}
                videoWidth={VIDEO_W}
                videoHeight={VIDEO_H}
                videoMargin={VIDEO_MARGIN}
                videoGap={VIDEO_GAP}
                iconSize={ICON_SIZE}
                roadmapPositions={roadmapPosition}
                roadmapVideosByPosition={videosByRoadmap}
                roadmapPositionVideosByPosition={emptyVideos}
                freeTierVideosByPosition={emptyVideos}
                availableVideosByPosition={videosByRoadmap}
                availablePositionVideosByPosition={emptyVideos}
                completedVideoIdSet={new Set()}
                isSubscribed
                showEmptyPositions
                samplePositionPlaceholderUrl={SAMPLE_POSITION_PLACEHOLDER_URL}
                sampleVideoPlaceholderUrl={SAMPLE_PLACEHOLDER_URL}
                onNodePress={() => undefined}
                onEmptyPositionPress={() => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id } })}
                onEmptyPositionVideoPress={() => undefined}
                onVideoPress={(_position, _index, video) => router.push({ pathname: `/video-upload/${video.video_upload_id}`, params: { segmentId: video.id, startTime: String(video.start_time ?? 0), endTime: String(video.end_time ?? 0), category: video.category_name ?? 'Misc', title: video.title ?? '', description: video.description ?? '' } })}
                onLockedPositionPress={() => undefined}
                onToggleCompletion={() => undefined}
            />
        </ThemedView>
    )
}
