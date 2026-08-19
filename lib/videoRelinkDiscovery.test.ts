import { describe, expect, it, jest } from '@jest/globals'
import { findVideoRelinkCandidates } from './videoRelinkDiscovery'

const upload = {
    content_hash: 'a'.repeat(64),
    file_size_bytes: 100,
    duration_seconds: 12,
}

describe('findVideoRelinkCandidates', () => {
    it('filters unrelated candidates before hashing and finds the correct local video', async () => {
        const calculateHash = jest.fn(async (uri: string) => (
            uri === 'file:///candidate.mp4' ? upload.content_hash : 'b'.repeat(64)
        ))

        await expect(findVideoRelinkCandidates(upload, [
            { uri: 'file:///wrong-size.mp4', fileSize: 99, durationSeconds: 12 },
            { uri: 'file:///wrong-duration.mp4', fileSize: 100, durationSeconds: 20 },
            { uri: 'file:///candidate.mp4', fileSize: 100, durationSeconds: 12 },
        ], calculateHash)).resolves.toEqual([
            { uri: 'file:///candidate.mp4', fileSize: 100, durationSeconds: 12 },
        ])

        expect(calculateHash).toHaveBeenCalledTimes(1)
        expect(calculateHash).toHaveBeenCalledWith('file:///candidate.mp4')
    })

    it('returns matching duplicates in a deterministic URI order', async () => {
        await expect(findVideoRelinkCandidates(upload, [
            { uri: 'file:///z-copy.mp4', fileSize: 100, durationSeconds: 12 },
            { uri: 'file:///a-copy.mp4', fileSize: 100, durationSeconds: 12 },
        ], async () => upload.content_hash)).resolves.toEqual([
            { uri: 'file:///a-copy.mp4', fileSize: 100, durationSeconds: 12 },
            { uri: 'file:///z-copy.mp4', fileSize: 100, durationSeconds: 12 },
        ])
    })

    it('does not hash legacy records without a stored content hash', async () => {
        const calculateHash = jest.fn(async () => 'a'.repeat(64))

        await expect(findVideoRelinkCandidates({ ...upload, content_hash: null }, [
            { uri: 'file:///candidate.mp4', fileSize: 100, durationSeconds: 12 },
        ], calculateHash)).resolves.toEqual([])
        expect(calculateHash).not.toHaveBeenCalled()
    })
})