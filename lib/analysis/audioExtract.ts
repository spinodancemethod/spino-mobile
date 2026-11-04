import * as FileSystem from 'expo-file-system/legacy'
import { extractAudio, isAudioExtractAvailable } from '../../modules/audio-extract'

export type ExtractedAudio = { uri: string; durationSeconds: number; sizeBytes: number; mimeType: string }

/**
 * Produce the audio-only file that is uploaded for analysis. The video itself
 * never leaves the device (spec v2 §2). Output lives in the app cache and is
 * deleted by the caller after upload.
 */
export async function extractAudioForAnalysis(videoUri: string, jobId: string): Promise<ExtractedAudio> {
    if (!isAudioExtractAvailable()) {
        throw new Error('This build cannot extract audio yet. Rebuild the development client to include the AudioExtract module.')
    }
    const dir = `${FileSystem.cacheDirectory}fable-audio/`
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined)
    const outputPath = `${dir}${jobId}.m4a`
    const result = await extractAudio(videoUri, outputPath)
    return { ...result, mimeType: 'audio/mp4' }
}

export async function discardExtractedAudio(uri: string) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
}
