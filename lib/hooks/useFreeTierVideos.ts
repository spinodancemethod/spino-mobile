import { useQuery } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';
import { supabase } from '../supabase';

/*
    Hook: useFreeTierVideos

    - Fetches all videos marked with access_tier = 'free'.
    - Used to populate the roadmap for non-subscribed users without requiring favourites.
*/
async function fetchFreeTierVideos(): Promise<VideoRecord[]> {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('access_tier', 'free')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as VideoRecord[];
}

export function useFreeTierVideos() {
    return useQuery<VideoRecord[], Error>({
        queryKey: queryKeys.freeTierVideos(),
        queryFn: fetchFreeTierVideos,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}