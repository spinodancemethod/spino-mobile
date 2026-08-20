const AUTH_NETWORK_RETRY_DELAYS_MS = [500, 1_500]

function isTransientNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    return error.message.toLowerCase().includes('network request failed')
}

function wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs))
}

// Password sign-in has no local side effect until Supabase accepts the request,
// so retrying only a native transport failure is safe and avoids retrying bad credentials.
export async function retryTransientAuthNetworkFailure<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= AUTH_NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            const retryDelay = AUTH_NETWORK_RETRY_DELAYS_MS[attempt]
            if (!isTransientNetworkError(error) || retryDelay == null) throw error
            await wait(retryDelay)
        }
    }

    throw lastError
}