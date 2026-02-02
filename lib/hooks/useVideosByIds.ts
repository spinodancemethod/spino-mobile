import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * Fetcher used by the React Query hook. It reads ids from the queryKey.
 * queryKey shape: ['videosByIds', ids]
 */
async function fetchVideosByIds({ queryKey }: any) {
    const [_key, ids] = queryKey;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
    const { data, error } = await supabase.from('videos').select('*').in('id', ids).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export function useVideosByIds(ids?: string[] | null) {
    const enabled = !!(ids && ids.length > 0);
    return useQuery({
        queryKey: ['videosByIds', ids || []],
        queryFn: fetchVideosByIds,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
