import { buildChunks, nearestBeat } from './chunks'
import type { CountGrid } from '../models'

function countingGrid(): CountGrid {
    const count1 = [0, 4, 8]
    const beats = count1.flatMap((t) => Array.from({ length: 8 }, (_, k) => t + k * 0.5))
    return {
        mode: 'counting', confidence: 0.8, count_period_s: 0.5, count1_times: count1,
        bar_times: beats.filter((_, i) => i % 4 === 0), beat_times: beats,
        speech_spans: [[9, 12]], ambiguous_1_vs_5: false, duration_s: 12,
    }
}

describe('buildChunks', () => {
    it('cuts 8-count chunks on count 1 and labels them', () => {
        const c = buildChunks(countingGrid(), 8)
        expect(c.map((x) => [x.start, x.end])).toEqual([[0, 4], [4, 8], [8, 12]])
        expect(c.every((x) => x.countLabel === 1)).toBe(true)
    })

    it('cuts 4-count chunks alternating 1 and 5', () => {
        const c = buildChunks(countingGrid(), 4)
        expect(c.slice(0, 4).map((x) => x.countLabel)).toEqual([1, 5, 1, 5])
        expect(c[1]).toMatchObject({ start: 2, end: 4 })
    })

    it('marks chunks that are mostly talking', () => {
        const c = buildChunks(countingGrid(), 8)
        expect(c[2].talking).toBe(true)   // 8-12 s is covered by the 9-12 s speech span (75%)
        expect(c[0].talking).toBe(false)
    })

    it('does not straddle a restart after a pause', () => {
        const g = countingGrid()
        g.count1_times = [0, 4, 11]
        g.beat_times = [...Array.from({ length: 16 }, (_, k) => k * 0.5), ...Array.from({ length: 8 }, (_, k) => 11 + k * 0.5)]
        g.duration_s = 15
        const c = buildChunks(g, 8)
        expect(c.map((x) => [x.start, x.end])).toEqual([[0, 4], [4, 11], [11, 15]])
    })

    it('music: lead-in chunk, bar-aligned, unlabelled until phase is set', () => {
        const beats = Array.from({ length: 20 }, (_, k) => 0.3 + k * 0.5)
        const bars = beats.filter((_, k) => k % 4 === 2)
        const g: CountGrid = { mode: 'music', confidence: 0.3, count_period_s: 0.5, count1_times: bars.filter((_, i) => i % 2 === 0),
            bar_times: bars, beat_times: beats, speech_spans: [], ambiguous_1_vs_5: true, duration_s: 10 }
        const c = buildChunks(g, 8)
        expect(c[0]).toMatchObject({ start: 0, end: 1.3, countLabel: null })
        expect(c[1].start).toBe(1.3)
        // with the user's tap: bar parity 0 is "1"
        const labelled = buildChunks(g, 4, 0)
        expect(labelled.slice(1, 3).map((x) => x.countLabel)).toEqual([1, 5])
    })
})

describe('nearestBeat', () => {
    it('snaps to the closest count', () => {
        expect(nearestBeat(countingGrid(), 2.2)).toBe(2)
        expect(nearestBeat(countingGrid(), 2.3)).toBe(2.5)
    })
})
