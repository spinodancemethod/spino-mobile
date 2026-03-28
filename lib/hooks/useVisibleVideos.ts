import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/*
    Hook: useVisibleVideos

    - Fetches all videos currently visible to the authenticated user via RLS.
    - Useful for per-position availability checks (e.g., showing add/plus tiles
      even when the user has not added anything to their roadmap yet).
*/
async function fetchVisibleVideos() {
    const { data, error } = await supabase
        .from('videos')
        .select('id,position_id,access_tier')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export function useVisibleVideos() {
    return useQuery({
        queryKey: ['videos', 'visible'],
        queryFn: fetchVisibleVideos,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}