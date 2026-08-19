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

export async function calculateVideoContentHash(uri: string): Promise<string> {
    const { File } = await import('expo-file-system')
    const file = new File(uri)
    if (!file.exists) {
        throw new Error('The selected video is no longer available.')
    }
    return sha256FromReader(file.open())
}