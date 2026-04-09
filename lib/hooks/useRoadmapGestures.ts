import { useCallback, useEffect, useRef } from 'react'
import { Animated, LayoutChangeEvent, PanResponder, View } from 'react-native'

type UseRoadmapGesturesParams = {
    minScale: number;
    maxScale: number;
    defaultScale: number;
    surfaceWidth: number;
    defaultPanX: number;
    defaultPanY: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function useRoadmapGestures({
    minScale,
    maxScale,
    defaultScale,
    surfaceWidth,
    defaultPanX,
    defaultPanY,
}: UseRoadmapGesturesParams) {
    // Animated values are stable refs so gesture updates stay smooth.
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
    const scale = useRef(new Animated.Value(defaultScale)).current

    const lastPan = useRef({ x: 0, y: 0 })
    const lastScale = useRef(defaultScale)
    const initialTouches = useRef<{ x: number; y: number }[] | null>(null)
    const initialDistance = useRef<number | null>(null)
    const surfaceHeightRef = useRef(0)

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
                    return
                }

                initialTouches.current = null
                initialDistance.current = null
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
                        const nextScale = clamp(lastScale.current * scaleFactor, minScale, maxScale)
                        scale.setValue(nextScale)

                        // Translate absolute touch coordinates into canvas-relative coordinates
                        // so pinch focal compensation works regardless of screen offset.
                        const ox = canvasOffset.current.x
                        const oy = canvasOffset.current.y
                        const midX = (touches[0].pageX + touches[1].pageX) / 2 - ox
                        const midY = (touches[0].pageY + touches[1].pageY) / 2 - oy

                        if (initialTouches.current) {
                            const initMidX = (initialTouches.current[0].x + initialTouches.current[1].x) / 2 - ox
                            const initMidY = (initialTouches.current[0].y + initialTouches.current[1].y) / 2 - oy

                            const ratio = nextScale / lastScale.current
                            const cx = surfaceWidth / 2
                            const cy = surfaceHeightRef.current / 2
                            const newPanX = midX + ratio * (lastPan.current.x - initMidX) + cx * (ratio - 1)
                            const newPanY = midY + ratio * (lastPan.current.y - initMidY) + cy * (ratio - 1)
                            pan.setValue({ x: newPanX, y: newPanY })
                        }
                    }

                    return
                }

                pan.setValue({
                    x: lastPan.current.x + gestureState.dx,
                    y: lastPan.current.y + gestureState.dy,
                })
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

    useEffect(() => {
        pan.setValue({ x: defaultPanX, y: defaultPanY })
        scale.setValue(defaultScale)
        lastPan.current = { x: defaultPanX, y: defaultPanY }
        lastScale.current = defaultScale
    }, [defaultPanX, defaultPanY, defaultScale, pan, scale])

    const setSurfaceHeight = useCallback((height: number) => {
        surfaceHeightRef.current = height
    }, [])

    return {
        canvasRef,
        onCanvasLayout,
        pan,
        panHandlers: panResponder.panHandlers,
        scale,
        setSurfaceHeight,
    }
}
