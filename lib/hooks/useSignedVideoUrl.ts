import { useQuery } from '@tanstack/react-query'
import { supabase } from 'lib/supabase'
import { queryKeys } from 'lib/queryKeys'

const SIGNED_URL_TTL_SECONDS = 3600 // 1 hour validity granted by Supabase
const CACHE_TTL_MS = 1000 * 60 * 50  // re-fetch after 50 min so the URL never expires while cached

async function fetchSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    if (!data?.signedUrl) throw new Error('No signed URL returned')
    return data.signedUrl
}

/**
 * Returns a signed URL for a Supabase Storage video file.
 *
 * The URL is cached in React Query for 50 minutes (just under the 1-hour
 * Supabase expiry), so repeated visits to the same video within a session
 * avoid hitting the Storage API each time.
 */
export function useSignedVideoUrl(filePath: string | null | undefined) {
    return useQuery<string, Error>({
        queryKey: queryKeys.signedVideoUrl(filePath),
        queryFn: () => fetchSignedUrl(filePath!),
        enabled: !!filePath,
        staleTime: CACHE_TTL_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 2,
    })
}
