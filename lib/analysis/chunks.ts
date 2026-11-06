import type { CountGrid } from '../models'

export type Chunk = {
    index: number
    start: number
    end: number
    /** 1 or 5 when the phase is known; null for music (until tapped) or lead-in chunks. */
    countLabel: 1 | 5 | null
    /** True when the instructor is talking for most of the chunk (shaded, still selectable). */
    talking: boolean
}

export type ChunkSize = 4 | 8

/**
 * Cut the video into chunks of `countsPerChunk` counts from the grid. Mirrors
 * `worker/fable/grid.py::chunks`. Chunks never straddle a detected 8-count
 * boundary (counting mode) and align to bars (music mode). A lead-in before the
 * first beat and a tail after the last beat become chunks of their own, so every
 * second of the video is selectable.
 */
export function buildChunks(grid: CountGrid, countsPerChunk: ChunkSize, phaseOffsetBars = 0): Chunk[] {
    const beats = grid.beat_times
    const out: Chunk[] = []
    if (!beats.length) {
        if (grid.duration_s > 0) out.push({ index: 0, start: 0, end: grid.duration_s, countLabel: null, talking: false })
        return out
    }
    const count1 = new Set(grid.count1_times)
    const bars = grid.bar_times
    const music = grid.mode === 'music'
    // Music: the user may tap a bar as "1"; phaseOffsetBars (0 or 1) says which bar parity is 1.
    const labelFor = (t: number): 1 | 5 | null => {
        if (music) {
            if (grid.ambiguous_1_vs_5 && phaseOffsetBars == null) return null
            const bi = bars.indexOf(t)
            if (bi < 0) return null
            return ((bi - phaseOffsetBars) % 2 + 2) % 2 === 0 ? 1 : 5
        }
        if (count1.has(t)) return 1
        return bars.includes(t) ? 5 : null
    }
    let i = 0
    if (music && bars.length) {
        const firstBarIdx = beats.indexOf(bars[0])
        if (firstBarIdx > 0) i = firstBarIdx
    }
    if (beats[i] > 0.3) out.push({ index: 0, start: 0, end: beats[i], countLabel: null, talking: isTalking(grid, 0, beats[i]) })
    while (i < beats.length) {
        let j = i + countsPerChunk
        if (!music && countsPerChunk >= 8) {
            for (let k = i + 1; k < Math.min(j, beats.length); k++) {
                if (count1.has(beats[k])) { j = k; break }
            }
        }
        const end = j < beats.length ? beats[j] : grid.duration_s
        if (end - beats[i] > 0.05) {
            out.push({ index: out.length, start: beats[i], end, countLabel: labelFor(beats[i]), talking: isTalking(grid, beats[i], end) })
        }
        i = j
    }
    return out.map((c, index) => ({ ...c, index }))
}

function isTalking(grid: CountGrid, start: number, end: number): boolean {
    const len = end - start
    if (len <= 0) return false
    let covered = 0
    for (const [a, b] of grid.speech_spans) {
        covered += Math.max(0, Math.min(b, end) - Math.max(a, start))
    }
    return covered / len > 0.5
}

/** Snap a time to the nearest beat (for dragging a snippet edge one count at a time). */
export function nearestBeat(grid: CountGrid, t: number): number {
    const b = grid.beat_times
    if (!b.length) return t
    let best = b[0]
    for (const x of b) if (Math.abs(x - t) < Math.abs(best - t)) best = x
    return best
}

export function formatClock(seconds: number): string {
    const s = Math.max(0, seconds)
    const m = Math.floor(s / 60)
    const r = s - m * 60
    return m > 0 ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)}s`
}
