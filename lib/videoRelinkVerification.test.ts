import { describe, expect, it, jest } from '@jest/globals'
import { verifyVideoRelinkCandidate } from './videoRelinkVerification'

const upload = {
    content_hash: 'a'.repeat(64),
    file_size_bytes: 42,
    duration_seconds: 15,
}

describe('verifyVideoRelinkCandidate', () => {
    it('accepts a renamed candidate only when its SHA-256 matches', async () => {
        const calculateHash = jest.fn(async () => upload.content_hash)

        await expect(verifyVideoRelinkCandidate(upload, {
            uri: 'file:///new-device/Renamed-video.mp4',
            fileSize: 42,
            durationSeconds: 15,
        }, calculateHash)).resolves.toEqual({ matches: true })
    })

    it('rejects a same-size and same-duration candidate with different content', async () => {
        await expect(verifyVideoRelinkCandidate(upload, {
            uri: 'file:///wrong-video.mp4',
            fileSize: 42,
            durationSeconds: 15,
        }, async () => 'b'.repeat(64))).resolves.toEqual({ matches: false, reason: 'HASH_MISMATCH' })
    })

    it('rejects a size mismatch before hashing', async () => {
        const calculateHash = jest.fn(async () => upload.content_hash)

        await expect(verifyVideoRelinkCandidate(upload, {
            uri: 'file:///wrong-size.mp4',
            fileSize: 43,
            durationSeconds: 15,
        }, calculateHash)).resolves.toEqual({ matches: false, reason: 'FILE_SIZE_MISMATCH' })
        expect(calculateHash).not.toHaveBeenCalled()
    })

    it('rejects a duration mismatch before hashing', async () => {
        const calculateHash = jest.fn(async () => upload.content_hash)

        await expect(verifyVideoRelinkCandidate(upload, {
            uri: 'file:///wrong-duration.mp4',
            fileSize: 42,
            durationSeconds: 20,
        }, calculateHash)).resolves.toEqual({ matches: false, reason: 'DURATION_MISMATCH' })
        expect(calculateHash).not.toHaveBeenCalled()
    })

    it('rejects legacy records without a content hash', async () => {
        const calculateHash = jest.fn(async () => 'a'.repeat(64))

        await expect(verifyVideoRelinkCandidate({
            ...upload,
            content_hash: null,
        }, {
            uri: 'file:///legacy-video.mp4',
            fileSize: 42,
            durationSeconds: 15,
        }, calculateHash)).resolves.toEqual({ matches: false, reason: 'HASH_UNAVAILABLE' })
        expect(calculateHash).not.toHaveBeenCalled()
    })

    it('leaves a candidate recoverable when it disappears during hashing', async () => {
        await expect(verifyVideoRelinkCandidate(upload, {
            uri: 'file:///disappeared.mp4',
            fileSize: 42,
            durationSeconds: 15,
        }, async () => { throw new Error('File disappeared') })).resolves.toEqual({ matches: false, reason: 'CANDIDATE_UNAVAILABLE' })
    })
})