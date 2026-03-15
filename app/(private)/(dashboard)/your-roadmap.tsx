import React, { useRef, useCallback, useState } from 'react'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import { View, Animated, PanResponder, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native'
import { useVideos } from 'lib/hooks/useVideos'
import { usePositions } from 'lib/hooks/usePositions'
import { router } from 'expo-router'
import { useTheme } from 'constants/useTheme'

// Scale bounds for pinch-to-zoom so users can inspect the roadmap comfortably.
const MIN_SCALE = 0.2
const MAX_SCALE = 3

// Surface center defaults.
const SURFACE_WIDTH = 1800
const START_X = SURFACE_WIDTH / 2
const START_Y = 200

// Node sizing for the roadmap tree layout.
const ROOT_WIDTH = 140
const ROOT_HEIGHT = 56
const NODE_WIDTH = 160
const NODE_HEIGHT = 44
const VIDEO_W = 120
const VIDEO_H = 66
const VIDEO_MARGIN = 12
const ICON_SIZE = 18
const STEM_GAP = 16
const POSITION_NODE_OFFSET = 20

const YourRoadmap = () => {
    const { mode, colors } = useTheme()

    // Animated state that drives drag and pinch interactions.
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
    const scale = useRef(new Animated.Value(1)).current

    // Refs preserve gesture state between touch events.
    const lastPan = useRef({ x: 0, y: 0 })
    const lastScale = useRef(1)
    const initialTouches = useRef<{ x: number; y: number }[] | null>(null)
    const initialDistance = useRef<number | null>(null)

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

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

                        // Midpoint movement lets a pinch gesture also pan the canvas.
                        const midX = (touches[0].pageX + touches[1].pageX) / 2
                        const midY = (touches[0].pageY + touches[1].pageY) / 2

                        if (initialTouches.current) {
                            const initMidX = (initialTouches.current[0].x + initialTouches.current[1].x) / 2
                            const initMidY = (initialTouches.current[0].y + initialTouches.current[1].y) / 2
                            const deltaX = midX - initMidX
                            const deltaY = midY - initMidY
                            pan.setValue({ x: lastPan.current.x + deltaX, y: lastPan.current.y + deltaY })
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

    const nodeCount = positions.length
    const videosPerNode = 3
    const maxGap = 80
    const minGap = 12
    const availableGap = nodeCount > 0 ? Math.max(0, (SURFACE_WIDTH - nodeCount * NODE_WIDTH) / (nodeCount + 1)) : minGap
    const childSpacing = Math.max(minGap, Math.min(maxGap, availableGap))
    const groupWidth = nodeCount * NODE_WIDTH + Math.max(0, nodeCount - 1) * childSpacing
    const groupStartX = START_X - groupWidth / 2 + NODE_WIDTH / 2

    // This helper renders crisp connector lines for the roadmap tree.
    const renderLine = (x1: number, y1: number, x2: number, y2: number, key: string) => {
        const dx = x2 - x1
        const dy = y2 - y1

        if (Math.abs(dx) < 1) {
            const top = Math.min(y1, y2)
            const height = Math.max(1, Math.abs(dy))
            const endTop = top + height - 4

            return (
                <React.Fragment key={`line-${key}`}>
                    <View
                        style={{
                            position: 'absolute',
                            left: x1 - 1,
                            top,
                            width: 2,
                            height,
                            backgroundColor: '#cbd5e1',
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            left: x1 - 4,
                            top: endTop,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#cbd5e1',
                        }}
                    />
                </React.Fragment>
            )
        }

        if (Math.abs(dy) < 1) {
            const left = Math.min(x1, x2)
            const width = Math.max(1, Math.abs(dx))

            return (
                <View
                    key={`line-${key}`}
                    style={{
                        position: 'absolute',
                        left,
                        top: y1 - 1,
                        width,
                        height: 2,
                        backgroundColor: '#cbd5e1',
                    }}
                />
            )
        }

        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI

        return (
            <View
                key={`line-${key}`}
                style={{
                    position: 'absolute',
                    left: x1,
                    top: y1,
                    width: length,
                    height: 2,
                    backgroundColor: '#cbd5e1',
                    transform: [{ rotate: `${angle}deg` }],
                }}
            />
        )
    }

    const childXs = positions.map((_: unknown, index: number) => groupStartX + index * (NODE_WIDTH + childSpacing))
    const firstChildX = childXs[0] ?? START_X
    const lastChildX = childXs[childXs.length - 1] ?? START_X
    const spineY = START_Y + ROOT_HEIGHT / 2 + 8

    const [selectedPos, setSelectedPos] = useState<any | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<{ pos: any; index: number } | null>(null)

    const onNodePress = useCallback((position: any) => {
        setSelectedPos(position)
    }, [])

    const onVideoPress = useCallback((position: any, index: number) => {
        setSelectedVideo({ pos: position, index })
    }, [])

    const PositionVideoStack: React.FC<{ pos: any; videosPerNode: number }> = ({ pos, videosPerNode: limit }) => {
        const { data: videos = [] } = useVideos(pos?.id ? { positionId: pos.id } : undefined)
        const items = videos.length > 0 ? videos.slice(0, limit) : Array.from({ length: limit })

        return (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
                {items.map((video: any, index: number) => {
                    const key = video?.id ?? index
                    const title = video?.title ?? `Video ${index + 1}`
                    const isComplete = Array.isArray(pos?.completedVideoIds)
                        ? pos.completedVideoIds.includes(video?.id ?? index)
                        : index % 2 === 0
                    const bgColor = isComplete ? '#16a34a' : '#94a3b8'

                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => {
                                if (video?.id) {
                                    router.push(`/video/${video.id}`)
                                    return
                                }

                                onVideoPress(pos, index)
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
                                        paddingHorizontal: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    },
                                ]}
                            >
                                <ThemedText variant="subheader" style={styles.nodeText} numberOfLines={1}>{title}</ThemedText>
                                <View
                                    style={{
                                        width: ICON_SIZE,
                                        height: ICON_SIZE,
                                        borderRadius: ICON_SIZE / 2,
                                        backgroundColor: bgColor,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <ThemedText style={{ color: '#fff', fontSize: 12, lineHeight: 12 }}>✓</ThemedText>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )
                })}
            </View>
        )
    }

    const closeModal = useCallback(() => setSelectedPos(null), [])
    const closeVideoModal = useCallback(() => setSelectedVideo(null), [])

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedText variant="title" style={{ padding: 12 }}>Your Roadmap</ThemedText>
            <View style={styles.canvasOuter} {...panResponder.panHandlers}>
                <Animated.View
                    style={[
                        styles.canvasInner,
                        {
                            transform: [
                                { translateX: pan.x },
                                { translateY: pan.y },
                                { scale },
                            ],
                        },
                    ]}
                >
                    <View style={styles.surface}>
                        {positions.length > 0 && (
                            <View
                                style={{
                                    position: 'absolute',
                                    left: firstChildX,
                                    top: spineY,
                                    width: Math.max(2, lastChildX - firstChildX),
                                    height: 2,
                                    backgroundColor: '#cbd5e1',
                                }}
                            />
                        )}

                        {positions.map((position: any, index: number) => {
                            const x = childXs[index]
                            const nodeTop = START_Y + ROOT_HEIGHT / 2 + 8 + 2 + 8 + POSITION_NODE_OFFSET

                            return (
                                <React.Fragment key={`stems-${position.id || index}`}>
                                    {renderLine(x, spineY, x, nodeTop - STEM_GAP, `stem-${position.id || index}`)}
                                </React.Fragment>
                            )
                        })}

                        <View style={[styles.rootBox, { left: START_X - ROOT_WIDTH / 2, top: START_Y - ROOT_HEIGHT / 2 }]}>
                            <ThemedText variant="subheader" style={styles.rootText}>Positions</ThemedText>
                        </View>

                        {positions.map((position: any, index: number) => {
                            const x = childXs[index]
                            const nodeTop = START_Y + ROOT_HEIGHT / 2 + 8 + 2 + 8 + POSITION_NODE_OFFSET
                            const nodeLeft = x - NODE_WIDTH / 2

                            return (
                                <React.Fragment key={position.id}>
                                    <View style={{ position: 'absolute', left: nodeLeft, top: nodeTop }}>
                                        <TouchableOpacity onPress={() => onNodePress(position)} activeOpacity={0.85}>
                                            <View
                                                style={[
                                                    styles.positionBox,
                                                    {
                                                        width: NODE_WIDTH,
                                                        height: NODE_HEIGHT,
                                                        borderRadius: 8,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        paddingHorizontal: 8,
                                                    },
                                                ]}
                                            >
                                                <ThemedText
                                                    variant="subheader"
                                                    style={{ ...styles.nodeText, fontSize: 16, textAlign: 'center', width: NODE_WIDTH - 16 }}
                                                >
                                                    {position.name || position.title || 'Position'}
                                                </ThemedText>
                                            </View>
                                        </TouchableOpacity>

                                        <PositionVideoStack pos={position} videosPerNode={videosPerNode} />
                                    </View>
                                </React.Fragment>
                            )
                        })}
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
                                <ThemedText
                                    variant="title"
                                    style={{ ...(styles.modalTitleText as any), marginBottom: 8, color: mode === 'dark' ? colors.title : styles.modalTitleText.color }}
                                >
                                    {selectedVideo ? `Video ${selectedVideo.index + 1}` : ''}
                                </ThemedText>
                                <ThemedText
                                    variant="subheader"
                                    style={{ ...(styles.modalBodyText as any), marginBottom: 16, color: mode === 'dark' ? colors.text : styles.modalBodyText.color }}
                                >
                                    {selectedVideo?.pos?.name || 'No position'}
                                </ThemedText>
                                <TouchableOpacity
                                    onPress={() => {
                                        const videoId = `${selectedVideo?.pos?.id || 'pos'}-v${selectedVideo?.index}`
                                        router.push(`/video/${videoId}`)
                                    }}
                                    style={[styles.modalCloseBtn, { backgroundColor: mode === 'dark' ? colors.primary : styles.modalCloseBtn.backgroundColor }]}
                                >
                                    <ThemedText style={{ color: '#fff' }}>Go to video</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={closeVideoModal}
                                    style={[styles.modalCloseBtn, { marginTop: 8, backgroundColor: mode === 'dark' ? colors.primary : styles.modalCloseBtn.backgroundColor }]}
                                >
                                    <ThemedText style={{ color: '#fff' }}>Close</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Modal>
                </Animated.View>
            </View>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
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
        width: '100%',
    },
    surface: {
        width: 1800,
        height: 1400,
        backgroundColor: 'transparent',
    },
    nodeText: {
        color: '#0f172a',
        fontWeight: '600',
    },
    rootBox: {
        position: 'absolute',
        width: ROOT_WIDTH,
        height: ROOT_HEIGHT,
        borderRadius: 6,
        backgroundColor: '#e6dfd6',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    rootText: {
        color: '#111827',
        fontWeight: '700',
    },
    leafBox: {
        backgroundColor: '#f2f7e7',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 1,
    },
    positionBox: {
        backgroundColor: '#fff7f9',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
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
})

export default YourRoadmap
