import { requireOptionalNativeModule } from 'expo'

type NativeAudioExtract = {
    /**
     * Copies the audio track of a local video into an .m4a file (AAC) without
     * re-encoding video. Returns the output file URI and its duration in seconds.
     * The video itself is never read by anything but the OS media APIs.
     */
    extractAudio(videoUri: string, outputPath: string): Promise<{ uri: string; durationSeconds: number; sizeBytes: number }>
}

const native = requireOptionalNativeModule<NativeAudioExtract>('AudioExtract')

export function isAudioExtractAvailable(): boolean {
    return native != null
}

export async function extractAudio(videoUri: string, outputPath: string) {
    if (!native) {
        throw new Error('AudioExtract native module is not in this build. Rebuild the dev client (npx expo run:ios / run:android).')
    }
    return native.extractAudio(videoUri, outputPath)
}
