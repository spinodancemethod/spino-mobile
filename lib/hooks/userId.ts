export function resolveUserId(preferredUserId?: string | null, authUserId?: string | null) {
    return preferredUserId ?? authUserId ?? null;
}

export function requireUserId(
    preferredUserId?: string | null,
    authUserId?: string | null,
    errorMessage = 'No authenticated user available'
) {
    const resolved = resolveUserId(preferredUserId, authUserId);
    if (!resolved) {
        throw new Error(errorMessage);
    }
    return resolved;
}