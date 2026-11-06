/**
 * Human-readable message for anything thrown. Supabase (PostgrestError,
 * StorageError) throws plain objects with a `message`, not Error instances,
 * so `instanceof Error` alone would hide the real reason behind a fallback.
 */
export function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message
    if (error && typeof error === 'object' && 'message' in error) {
        const m = (error as { message?: unknown }).message
        if (typeof m === 'string' && m) return m
    }
    return fallback
}
