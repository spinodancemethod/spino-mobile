import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/*
    Hook: useFreeTierVideos

    - Fetches all videos marked with access_tier = 'free'.
    - Used to populate the roadmap for non-subscribed users without requiring favourites.
*/
async function fetchFreeTierVideos() {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('access_tier', 'free')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export function useFreeTierVideos() {
    return useQuery({
        queryKey: ['videos', 'free-tier'],
        queryFn: fetchFreeTierVideos,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}