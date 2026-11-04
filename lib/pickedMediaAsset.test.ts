import { matchPickedMediaAsset } from './pickedMediaAsset'

const assets = [
    { id: 'a', filename: '1000136422.mp4', duration: 1.944 },
    { id: 'b', filename: 'VID.mp4', duration: 10 },
    { id: 'c', filename: 'VID.mp4', duration: 10.1 },
    { id: 'd', filename: 'other.mp4', duration: 1.944 },
]

describe('matchPickedMediaAsset', () => {
    it('matches on filename and duration', () => {
        expect(matchPickedMediaAsset({ fileName: '1000136422.mp4', durationSeconds: 1.9 }, assets)).toBe('a')
    })

    it('ignores filename case', () => {
        expect(matchPickedMediaAsset({ fileName: '1000136422.MP4', durationSeconds: 1.944 }, assets)).toBe('a')
    })

    it('rejects a duration outside tolerance', () => {
        expect(matchPickedMediaAsset({ fileName: '1000136422.mp4', durationSeconds: 5 }, assets)).toBeNull()
    })

    it('refuses ambiguous matches', () => {
        expect(matchPickedMediaAsset({ fileName: 'VID.mp4', durationSeconds: 10 }, assets)).toBeNull()
    })

    it('matches on filename alone when duration is unknown', () => {
        expect(matchPickedMediaAsset({ fileName: 'other.mp4', durationSeconds: null }, assets)).toBe('d')
    })

    it('returns null without a filename', () => {
        expect(matchPickedMediaAsset({ fileName: null, durationSeconds: 1.944 }, assets)).toBeNull()
    })
})
