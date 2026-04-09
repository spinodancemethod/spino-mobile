import { useQuery } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';
import { supabase } from '../supabase';

/*
    Hook: useVisibleVideos

    - Fetches all videos currently visible to the authenticated user via RLS.
    - Useful for per-position availability checks (e.g., showing add/plus tiles
      even when the user has not added anything to their roadmap yet).
*/
async function fetchVisibleVideos(): Promise<VideoRecord[]> {
    const { data, error } = await supabase
        .from('videos')
        .select('id,position_id,access_tier')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as VideoRecord[];
}

export function useVisibleVideos() {
    return useQuery<VideoRecord[], Error>({
        queryKey: queryKeys.visibleVideos(),
        queryFn: fetchVisibleVideos,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}