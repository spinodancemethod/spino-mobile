import React from 'react'
import { Animated, LayoutChangeEvent, PanResponderInstance, Pressable, TouchableOpacity, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import ThemedText from 'Components/ThemedText'
import { RoadmapPosition, RoadmapVideo } from './types'

type RoadmapCanvasProps = {
    styles: any;
    canvasRef: React.RefObject<View | null>;
    onCanvasLayout: (_event: LayoutChangeEvent) => void;
    panHandlers: PanResponderInstance['panHandlers'];
    pan: Animated.ValueXY;
    scale: Animated.Value;
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
    availablePositionVideosByPosition: Map<string, RoadmapVideo[]>;
    completedVideoIdSet: Set<string>;
    isSubscribed: boolean;
    showEmptyPositions: boolean;
    samplePositionPlaceholderUrl: string;
    sampleVideoPlaceholderUrl: string;
    onNodePress: (position: RoadmapPosition) => void;
    onEmptyPositionPress: (position: RoadmapPosition) => void;
    onEmptyPositionVideoPress: (position: RoadmapPosition) => void;
    onVideoPress: (position: RoadmapPosition, index: number, video: RoadmapVideo) => void;
    onLockedPositionPress: (position: RoadmapPosition) => void;
    onToggleCompletion: (videoId: string, isComplete: boolean) => void;
}

export function RoadmapCanvas({
    styles,
    canvasRef,
    onCanvasLayout,
    panHandlers,
    pan,
    scale,
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
    availablePositionVideosByPosition,
    completedVideoIdSet,
    isSubscribed,
    showEmptyPositions,
    samplePositionPlaceholderUrl,
    sampleVideoPlaceholderUrl,
    onNodePress,
    onEmptyPositionPress,
    onEmptyPositionVideoPress,
    onVideoPress,
    onLockedPositionPress,
    onToggleCompletion,
}: RoadmapCanvasProps) {
    const PositionVideoStack: React.FC<{ pos: RoadmapPosition; videos: RoadmapVideo[]; showEmptyState: boolean }> = ({ pos, videos, showEmptyState }) => {
        const hasVisibleFreeVideos = (freeTierVideosByPosition.get(pos?.id)?.length ?? 0) > 0
        const hasRoadmapVideos = videos.length > 0
        const hasVisibleVideos = (availableVideosByPosition.get(pos?.id)?.length ?? 0) > 0

        const shouldShowNoFavouritesTile = !isSubscribed && !hasRoadmapVideos && hasVisibleFreeVideos
        const shouldShowSubscribeTile = !isSubscribed && !hasVisibleFreeVideos && !hasRoadmapVideos
        const shouldShowAddTile = isSubscribed && !hasRoadmapVideos && (showEmptyState || hasVisibleVideos)
        const shouldShowAddButton = hasRoadmapVideos || shouldShowAddTile || shouldShowNoFavouritesTile

        if (videos.length === 0 && !shouldShowAddButton && !shouldShowSubscribeTile) {
            return null
        }

        const addButton = (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onEmptyPositionPress(pos)}
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
                        onPress={() => onLockedPositionPress(pos)}
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

                {videos.map((video: RoadmapVideo, index: number) => {
                    const key = video?.id ?? `${pos?.id}-fav-${index}`
                    const title = video?.title ?? `Video ${index + 1}`
                    const isComplete = !!video?.id && completedVideoIdSet.has(video.id)
                    const bgColor = isComplete ? '#16a34a' : '#94a3b8'

                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => onVideoPress(pos, index, video)}
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
                                            onToggleCompletion(video.id, isComplete)
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
                                    source={{ uri: video?.roadmap_preview_url ?? sampleVideoPlaceholderUrl }}
                                    style={styles.videoGif}
                                    contentFit="cover"
                                />
                                <ThemedText variant="small" style={styles.zoomHintText}>Tap to preview</ThemedText>
                            </View>
                        </TouchableOpacity>
                    )
                })}

                {hasRoadmapVideos && shouldShowAddButton && addButton}
            </View>
        )
    }

    const PositionEntryStack: React.FC<{ pos: RoadmapPosition; videos: RoadmapVideo[]; showAddButton: boolean }> = ({ pos, videos, showAddButton }) => {
        if (videos.length === 0 && !showAddButton) {
            return null
        }

        return (
            <View style={styles.videoRow}>
                {showAddButton && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onEmptyPositionVideoPress(pos)}
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
                            onPress={() => onVideoPress(pos, index, video)}
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
                                            onToggleCompletion(video.id, isComplete)
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
                                    source={{ uri: video?.roadmap_preview_url ?? sampleVideoPlaceholderUrl }}
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

    return (
        <View ref={canvasRef} onLayout={onCanvasLayout} style={styles.canvasOuter} {...panHandlers}>
            <Animated.View
                style={[
                    styles.canvasInner,
                    { width: surfaceWidth, minHeight: estimatedSurfaceHeight },
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
                        <View style={styles.selectedVideosHeaderLeft}>
                            <ThemedText variant="subheader" style={styles.selectedVideosHeaderText}>Position videos</ThemedText>
                        </View>
                        <View style={[styles.rootBox, styles.rootBoxStatic]}>
                            <ThemedText variant="subheader" style={styles.rootText}>Positions</ThemedText>
                        </View>
                        <View style={styles.selectedVideosHeaderRight}>
                            <ThemedText variant="subheader" style={styles.selectedVideosHeaderText}>Chosen videos</ThemedText>
                        </View>
                    </View>

                    {roadmapPositions.map((position: RoadmapPosition) => {
                        const positionRoadmapVideos = roadmapPositionVideosByPosition.get(position.id) ?? []
                        const positionFavouriteVideos = roadmapVideosByPosition.get(position.id) ?? []
                        const hasRoadmapPositionVideos = positionRoadmapVideos.length > 0
                        const hasAvailablePositionVideos = (availablePositionVideosByPosition.get(position.id)?.length ?? 0) > 0
                        const positionAllowsVideos = position?.has_videos !== false
                        // Keep left-lane add affordance visible for free users even when there
                        // are no currently available free position videos for that position.
                        const shouldShowPositionAddButton = positionAllowsVideos && (
                            !isSubscribed || hasRoadmapPositionVideos || hasAvailablePositionVideos || showEmptyPositions
                        )

                        return (
                            <View key={position.id} style={styles.roadmapRow}>
                                <View style={styles.leftVideosColumn}>
                                    <PositionEntryStack
                                        pos={position}
                                        videos={positionRoadmapVideos}
                                        showAddButton={shouldShowPositionAddButton}
                                    />
                                </View>

                                <View style={styles.connectorStub} />

                                <View style={styles.positionColumn}>
                                    <TouchableOpacity onPress={() => onNodePress(position)} activeOpacity={0.85}>
                                        <View
                                            style={[
                                                styles.positionBox,
                                                styles.positionBoxStatic,
                                                {
                                                    width: positionColumnWidth,
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
                                                source={{ uri: position?.roadmap_preview_url ?? samplePositionPlaceholderUrl }}
                                                style={styles.positionPlaceholderImage}
                                                contentFit="cover"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.connectorStub} />

                                <View style={styles.rightVideosColumn}>
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
            </Animated.View>
        </View>
    )
}
