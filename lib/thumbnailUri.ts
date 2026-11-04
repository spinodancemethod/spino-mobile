import * as FileSystem from 'expo-file-system/legacy'
import { toRuntimeUri } from './localVideoStore'

/** Display form of a stored thumbnail reference (portable appdocs:// or a legacy absolute path). */
export function thumbnailDisplayUri(reference: string | null | undefined): string | undefined {
    if (!reference) return undefined
    return toRuntimeUri(reference, FileSystem.documentDirectory)
}
