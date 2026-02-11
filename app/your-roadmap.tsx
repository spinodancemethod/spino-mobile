import React, { useRef, useCallback } from 'react'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import GlobalMenu from 'Components/GlobalMenu'
import { View, Animated, PanResponder, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { usePositions } from 'lib/hooks/usePositions'

// Scale bounds for pinch-to-zoom (lower MIN_SCALE allows zooming out further)
const MIN_SCALE = 0.2
const MAX_SCALE = 3


// Surface center defaults
const SURFACE_WIDTH = 1800
const SURFACE_HEIGHT = 1400
const START_X = SURFACE_WIDTH / 2
const START_Y = 200

// Node sizing for layout
const ROOT_WIDTH = 140
const ROOT_HEIGHT = 56
// larger node for clearer visuals
const NODE_WIDTH = 160
const NODE_HEIGHT = 44
const VIDEO_W = 120
const VIDEO_H = 66
// reduced vertical gap between video leaves
const VIDEO_MARGIN = 6
// gap between the end of a stem and the top of a position node
const STEM_GAP = 0
// extra vertical offset to nudge position nodes lower on the canvas
const POSITION_NODE_OFFSET = 20


const YourRoadmap = () => {
    // Animated state
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
    const scale = useRef(new Animated.Value(1)).current

    // Refs to keep the last values between gestures
    const lastPan = useRef({ x: 0, y: 0 })
    const lastScale = useRef(1)
    const initialTouches = useRef<{ x: number; y: number }[] | null>(null)
    const initialDistance = useRef<number | null>(null)

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

    const panResponder = useRef(
        PanResponder.create({
            // Do not claim the responder on touch start so child touchables (nodes)
            // can receive taps. Claim the responder when the user moves a finger
            // (drag) past a small threshold or when using two fingers (pinch).
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches
                // claim when two-finger gestures (pinch/drag) or significant move
                return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6
            },
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches
                return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6
            },

            onPanResponderGrant: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches

                // read current animated values to avoid jumps when gestures start
                pan.x.stopAnimation((x: number) => {
                    pan.y.stopAnimation((y: number) => {
                        lastPan.current = { x, y }
                    })
                })
                scale.stopAnimation((s: number) => {
                    lastScale.current = s
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
                    // If pinch just started but we didn't get initial distance in grant, set it now
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
                        // Pinch
                        const dx = touches[0].pageX - touches[1].pageX
                        const dy = touches[0].pageY - touches[1].pageY
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        const scaleFactor = dist / initialDistance.current
                        const nextScale = clamp(lastScale.current * scaleFactor, MIN_SCALE, MAX_SCALE)
                        scale.setValue(nextScale)

                        // Move based on midpoint movement so two-finger drag also pans
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
                    // Single-finger pan
                    pan.setValue({ x: lastPan.current.x + gestureState.dx, y: lastPan.current.y + gestureState.dy })
                }
            },

            onPanResponderRelease: (evt, gestureState) => {
                // Save last values by reading current animated values via stopAnimation callbacks
                pan.x.stopAnimation((x: number) => {
                    pan.y.stopAnimation((y: number) => {
                        lastPan.current = { x, y }
                    })
                })
                scale.stopAnimation((s: number) => {
                    lastScale.current = s
                })
                initialTouches.current = null
                initialDistance.current = null
            },

            onPanResponderTerminationRequest: () => true,
        })
    ).current

    // Load positions
    const { data: positions = [] } = usePositions(undefined)

    // Layout positions in a row beneath the Start node (tree-like)
    const nodeCount = positions.length
    const videosPerNode = 3

    // compute spacing while centering the entire group beneath Start
    // tighter bounds so columns are closer together and use available surface width
    const maxGap = 80
    const minGap = 12
    const availableGap = nodeCount > 0 ? Math.max(0, (SURFACE_WIDTH - nodeCount * NODE_WIDTH) / (nodeCount + 1)) : minGap
    const childSpacing = Math.max(minGap, Math.min(maxGap, availableGap))
    const groupWidth = nodeCount * NODE_WIDTH + Math.max(0, nodeCount - 1) * childSpacing
    const groupStartX = START_X - groupWidth / 2 + NODE_WIDTH / 2

    // compute vertical gap below Start so videos don't overlap with nodes
    // videoStackHeight is used conceptually; individual offsets are applied below
    const videoStackHeight = videosPerNode * (VIDEO_H + VIDEO_MARGIN)

    // helper to render a simple connector line between two points
    // Helper: render a connector line between two surface coordinates.
    // Special-cases vertical/horizontal for crisp pixel-aligned rendering.
    const renderLine = (x1: number, y1: number, x2: number, y2: number, key: string) => {
        const dx = x2 - x1
        const dy = y2 - y1
        // Vertical line: render as a 2px-wide absolute View for crisp alignment.
        if (Math.abs(dx) < 1) {
            const top = Math.min(y1, y2)
            const height = Math.max(1, Math.abs(dy))
            const endTop = top + height - 4 // end-cap position
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
                    {/* end-cap circle so the stem clearly terminates before the node */}
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

        // horizontal line
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

        // Diagonal fallback: simple rotated bar. It's fine for short connectors.
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

    // compute child X positions centered as a group beneath Start
    const childXs = positions.map((_: any, i: number) => groupStartX + i * (NODE_WIDTH + childSpacing))
    const firstChildX = childXs[0] ?? START_X
    const lastChildX = childXs[childXs.length - 1] ?? START_X
    // reduced vertical offset for the spine to compact layout
    const spineY = START_Y + ROOT_HEIGHT / 2 + 8

    const onNodePress = useCallback((pos: any) => {
        const title = pos?.name || pos?.title || 'Position'
        const id = pos?.id ? String(pos.id) : ''
        Alert.alert(title, id ? `ID: ${id}` : undefined)
    }, [])

    // Handle click on a child video under a position
    const onVideoPress = useCallback((pos: any, index: number) => {
        const posTitle = pos?.name || pos?.title || 'Position'
        const vidLabel = `Video ${index + 1}`
        const id = pos?.id ? String(pos.id) : ''
        Alert.alert(vidLabel, `${posTitle}${id ? ` (position ID: ${id})` : ''}`)
    }, [])

    return (
        <ThemedView style={{ flex: 1 }}>

            <GlobalMenu />

            <View style={styles.headerContainer}>
                <ThemedText variant="title" style={{ marginBottom: 4 }}>Your roadmap</ThemedText>
                <ThemedText variant="subheader">Pinch to zoom, drag with one or two fingers to move the canvas.</ThemedText>
            </View>

            <View style={styles.canvasOuter} {...panResponder.panHandlers}>
                <Animated.View
                    style={[
                        styles.canvasInner,
                        {
                            transform: [
                                { translateX: pan.x },
                                { translateY: pan.y },
                                { scale: scale },
                            ],
                        },
                    ]}
                >
                    <View style={styles.surface}>
                        {/* Horizontal spine beneath the Root */}
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



                        {/* Vertical stems from spine down to each child */}
                        {positions.map((p: any, i: number) => {
                            const x = childXs[i]
                            // reduced nodeTop offset (nudged lower by POSITION_NODE_OFFSET)
                            const nodeTop = START_Y + ROOT_HEIGHT / 2 + 8 + 2 + 8 + POSITION_NODE_OFFSET
                            const spineX = x
                            const spineTopY = spineY
                            const spineBottomY = nodeTop - STEM_GAP
                            return (
                                <React.Fragment key={`stems-${p.id || i}`}>
                                    {renderLine(spineX, spineTopY, spineX, spineBottomY, `stem-${p.id || i}`)}
                                </React.Fragment>
                            )
                        })}

                        {/* Root box */}
                        <View style={[styles.rootBox, { left: START_X - ROOT_WIDTH / 2, top: START_Y - ROOT_HEIGHT / 2 }]}>
                            <ThemedText variant="subheader" style={styles.rootText}>Positions</ThemedText>
                        </View>

                        {/* Child circular nodes and video leaves */}
                        {positions.map((p: any, i: number) => {
                            const x = childXs[i]
                            const yTop = START_Y + ROOT_HEIGHT / 2 + 8 + 2 + 8 + POSITION_NODE_OFFSET
                            const nodeLeft = x - NODE_WIDTH / 2
                            const nodeTop = yTop
                            // compute where the video stack starts relative to the surface
                            const videoContainerTop = nodeTop + NODE_HEIGHT + 16
                            const stemStartY = nodeTop + NODE_HEIGHT
                            const stemEndY = videoContainerTop
                            return (
                                <React.Fragment key={p.id}>
                                    {/* vertical connector from node bottom to video stack top */}
                                    {renderLine(x, stemStartY, x, stemEndY, `node-child-${p.id || i}`)}

                                    <View style={{ position: 'absolute', left: nodeLeft, top: nodeTop }}>
                                        <TouchableOpacity onPress={() => onNodePress(p)} activeOpacity={0.85}>
                                            <View style={[styles.positionBox, { width: NODE_WIDTH, height: NODE_HEIGHT, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }]}>
                                                <ThemedText
                                                    variant="subheader"
                                                    style={{ ...styles.nodeText, fontSize: 16, textAlign: 'center', width: NODE_WIDTH - 16 }}
                                                >
                                                    {p.name || p.title || 'Position'}
                                                </ThemedText>
                                            </View>
                                        </TouchableOpacity>

                                        {/* videos as leaf nodes below (increased vertical gap) */}
                                        <View style={{ marginTop: 16, alignItems: 'center' }}>
                                            {Array.from({ length: videosPerNode }).map((_, vi) => (
                                                <TouchableOpacity key={vi} onPress={() => onVideoPress(p, vi)} activeOpacity={0.85}>
                                                    <View style={[styles.leafBox, { width: VIDEO_W, height: VIDEO_H, marginVertical: VIDEO_MARGIN / 2 }]}>
                                                        <ThemedText variant="subheader" style={styles.nodeText} numberOfLines={1}>Video {vi + 1}</ThemedText>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </React.Fragment>
                            )
                        })}
                    </View>
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
        // center the large surface so users start in the middle
        width: '100%'
    },
    surface: {
        width: 1800,
        height: 1400,
        // make the canvas background transparent so it matches the surrounding page
        backgroundColor: 'transparent',
    },
    node: {
        position: 'absolute',
        width: 80,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    videoPlaceholder: {
        width: 160,
        height: 90,
        borderRadius: 8,
        backgroundColor: '#fff',
        marginVertical: 6,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
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
    // position nodes now share the same box styling as leaf nodes (shadow/elevation)
    circleNode: {
        backgroundColor: '#fde8ef', // distinct color from leafBox
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
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
})

export default YourRoadmap
