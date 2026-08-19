import { createHash } from 'crypto'
import { describe, expect, it, jest } from '@jest/globals'

jest.mock('@noble/hashes/sha2.js', () => ({
    sha256: {
        create: () => {
            const hash = createHash('sha256')
            return {
                update: (bytes: Uint8Array) => {
                    hash.update(bytes)
                    return this
                },
                digest: () => new Uint8Array(hash.digest()),
            }
        },
    },
}))

import { sha256FromChunks, sha256FromReader } from './videoHash'

function chunksFromText(value: string, chunkSize: number): Uint8Array[] {
    const bytes = new TextEncoder().encode(value)
    const chunks: Uint8Array[] = []
    for (let index = 0; index < bytes.length; index += chunkSize) {
        chunks.push(bytes.slice(index, index + chunkSize))
    }
    return chunks
}

describe('sha256FromChunks', () => {
    it('returns the same SHA-256 for the same content regardless of chunk boundaries', () => {
        const singleChunk = chunksFromText('dance-memory-video', 1024)
        const smallChunks = chunksFromText('dance-memory-video', 3)
        const hashChunks = (chunks: Uint8Array[]) => {
            let index = 0
            return sha256FromChunks(() => chunks[index++] ?? null)
        }

        expect(hashChunks(singleChunk)).toBe(hashChunks(smallChunks))
    })

    it('returns a different SHA-256 for different content', () => {
        const hashText = (value: string) => {
            const chunks = chunksFromText(value, 2)
            let index = 0
            return sha256FromChunks(() => chunks[index++] ?? null)
        }

        expect(hashText('original video bytes')).not.toBe(hashText('different video bytes'))
    })
})

describe('sha256FromReader', () => {
    it('closes the reader after hashing', () => {
        const chunks = chunksFromText('abc', 1)
        let index = 0
        let closed = false

        const hash = sha256FromReader({
            readBytes: () => chunks[index++] ?? new Uint8Array(),
            close: () => { closed = true },
        }, 1)

        expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
        expect(closed).toBe(true)
    })

    it('closes the reader when reading fails', () => {
        let closed = false

        expect(() => sha256FromReader({
            readBytes: () => { throw new Error('Video disappeared') },
            close: () => { closed = true },
        })).toThrow('Video disappeared')
        expect(closed).toBe(true)
    })
})