import { describe, expect, it } from '@jest/globals'
import { hasPotentialVideoMetadataMatch } from './videoLibraryScanner'

describe('hasPotentialVideoMetadataMatch', () => {
    const uploads = [{ file_size_bytes: 100, duration_seconds: 12 }]

    it('filters unrelated files before an expensive hash is calculated', () => {
        expect(hasPotentialVideoMetadataMatch({ fileSize: 99, durationSeconds: 12 }, uploads)).toBe(false)
        expect(hasPotentialVideoMetadataMatch({ fileSize: 100, durationSeconds: 15 }, uploads)).toBe(false)
        expect(hasPotentialVideoMetadataMatch({ fileSize: 100, durationSeconds: 12 }, uploads)).toBe(true)
    })
})