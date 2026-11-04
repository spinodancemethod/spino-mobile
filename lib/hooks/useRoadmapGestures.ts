import { useCallback, useEffect, useMemo } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

type UseRoadmapGesturesParams = {
    minScale: number;
    maxScale: number;
    defaultScale: number;
    surfaceWidth: number;
    defaultPanX: number;
    defaultPanY: number;
}

/**
 * Pan + pinch for the roadmap surface, on gesture-handler and Reanimated.
 *
 * Why not the old PanResponder: the tiles on the surface now carry their own
 * long-press drag gestures (reorder). With gesture-handler the arbitration is
 * automatic: a one-finger move of more than `minDistance` activates the canvas
 * pan and cancels any pending tile drag; a long press that activates a tile
 * drag cancels the canvas pan. Nothing to coordinate by hand.
 */
export function useRoadmapGestures({
    minScale,
    maxScale,
    defaultScale,
    surfaceWidth,
    defaultPanX,
    defaultPanY,
}: UseRoadmapGesturesParams) {
    const panX = useSharedValue(defaultPanX)
    const panY = useSharedValue(defaultPanY)
    const scale = useSharedValue(defaultScale)
    const surfaceHeight = useSharedValue(0)

    // Values at the start of the current gesture.
    const startPanX = useSharedValue(0)
    const startPanY = useSharedValue(0)
    const startScale = useSharedValue(defaultScale)
    // Pinch keeps its own start pan so the pan gesture cannot overwrite it mid-pinch.
    const pinchStartPanX = useSharedValue(0)
    const pinchStartPanY = useSharedValue(0)
    const focalX0 = useSharedValue(0)
    const focalY0 = useSharedValue(0)
    // The pan and pinch run simultaneously and both write panX/panY. While the
    // pinch is active the pan must yield (its translation is already folded into
    // the pinch focal), and when the pinch ends the pan has to re-baseline from
    // wherever the pinch left the surface. Without this, iOS keeps the one-finger
    // pan alive through the pinch, and on release it snaps the surface back to
    // `startPan + translation` measured from before the pinch began.
    const pinchActive = useSharedValue(false)
    const panNeedsRebase = useSharedValue(false)

    const resetViewport = useCallback((nextPanX: number, nextPanY: number, nextScale: number) => {
        panX.value = nextPanX
        panY.value = nextPanY
        scale.value = nextScale
    }, [panX, panY, scale])

    useEffect(() => {
        resetViewport(defaultPanX, defaultPanY, defaultScale)
    }, [defaultPanX, defaultPanY, defaultScale, resetViewport])

    const setSurfaceHeight = useCallback((height: number) => {
        surfaceHeight.value = height
    }, [surfaceHeight])

    const canvasGesture = useMemo(() => {
        const pan = Gesture.Pan()
            .minDistance(6)
            .onStart(() => {
                // Baseline on the first update rather than here: translation is
                // measured from the first touch down, not from activation, so a
                // pan that activates after a pinch (or after the 6px threshold)
                // already carries travel the surface has absorbed. Baselining
                // against the current pan makes the first update a no-op.
                panNeedsRebase.value = true
            })
            .onUpdate((e) => {
                if (pinchActive.value) return
                if (panNeedsRebase.value) {
                    startPanX.value = panX.value - e.translationX
                    startPanY.value = panY.value - e.translationY
                    panNeedsRebase.value = false
                }
                panX.value = startPanX.value + e.translationX
                panY.value = startPanY.value + e.translationY
            })
        const pinch = Gesture.Pinch()
            .onStart((e) => {
                pinchActive.value = true
                pinchStartPanX.value = panX.value
                pinchStartPanY.value = panY.value
                startScale.value = scale.value
                focalX0.value = e.focalX
                focalY0.value = e.focalY
            })
            .onUpdate((e) => {
                // When one finger lifts the focal collapses onto the remaining
                // finger; applying that would jump the surface, so ignore it.
                if (e.numberOfPointers < 2) return
                const next = Math.max(minScale, Math.min(maxScale, startScale.value * e.scale))
                // The scale transform pivots around the surface centre, so keep the
                // point under the fingers fixed by compensating the pan:
                //   screen = pan + c + scale * (p - c)  =>  pan = F - c - ratio * (F0 - pan0 - c)
                const ratio = next / startScale.value
                const cx = surfaceWidth / 2
                const cy = surfaceHeight.value / 2
                scale.value = next
                panX.value = e.focalX + ratio * (pinchStartPanX.value - focalX0.value) + cx * (ratio - 1)
                panY.value = e.focalY + ratio * (pinchStartPanY.value - focalY0.value) + cy * (ratio - 1)
            })
            .onFinalize(() => {
                pinchActive.value = false
                panNeedsRebase.value = true
            })
        return Gesture.Simultaneous(pan, pinch)
    }, [focalX0, focalY0, maxScale, minScale, panNeedsRebase, panX, panY, pinchActive, pinchStartPanX, pinchStartPanY, scale, startPanX, startPanY, startScale, surfaceHeight, surfaceWidth])

    const surfaceStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
    }))

    return {
        canvasGesture,
        surfaceStyle,
        /** Current zoom; tile drags divide finger movement by this to get surface units. */
        scale,
        setSurfaceHeight,
        resetViewport,
    }
}
