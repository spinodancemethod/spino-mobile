import { sha256 } from '@noble/hashes/sha2.js'

const HASH_CHUNK_SIZE_BYTES = 1024 * 1024

export type ByteChunkReader = {
    readBytes(length: number): Uint8Array
    close(): void
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function sha256FromChunks(readChunk: () => Uint8Array | null): string {
    const hash = sha256.create()
    let chunk = readChunk()
    while (chunk != null && chunk.length > 0) {
        hash.update(chunk)
        chunk = readChunk()
    }
    return bytesToHex(hash.digest())
}

export function sha256FromReader(reader: ByteChunkReader, chunkSize = HASH_CHUNK_SIZE_BYTES): string {
    try {
        return sha256FromChunks(() => reader.readBytes(chunkSize))
    } finally {
        reader.close()
    }
}

/** Bytes hashed from the head and from the tail of the file. */
const SAMPLE_BYTES = 1024 * 1024

/**
 * Content fingerprint of a local video: SHA-256 over `size`, the first 1 MB and
 * the last 1 MB. Hashing the whole file in JavaScript froze the UI for minutes
 * on a 70 MB clip; the sample is still unique in practice (size + encoder
 * header + trailing index) and reads in milliseconds. Prefixed `v2-` so it can
 * never collide with the earlier whole-file hashes.
 */
export async function calculateVideoContentHash(uri: string): Promise<string> {
    const { File, FileMode } = await import('expo-file-system')
    const file = new File(uri)
    if (!file.exists) {
        throw new Error('The selected video is no longer available.')
    }
    const size = file.size ?? 0
    // Read-only: the default mode opens for writing, which Android refuses for
    // media-library files owned by other apps (relink scan hashes those in place).
    const handle = file.open(FileMode.ReadOnly)
    try {
        const hash = sha256.create()
        hash.update(Uint8Array.from(`v2:${size}:`, (ch) => ch.charCodeAt(0)))
        hash.update(handle.readBytesSync(Math.min(SAMPLE_BYTES, size)))
        if (size > SAMPLE_BYTES * 2) {
            handle.offset = size - SAMPLE_BYTES
            hash.update(handle.readBytesSync(SAMPLE_BYTES))
        }
        return `v2-${bytesToHex(hash.digest())}`
    } finally {
        handle.close()
    }
}
