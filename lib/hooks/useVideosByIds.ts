import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';
import { supabase } from '../supabase';

/**
 * Fetcher used by the React Query hook. It reads ids from the queryKey.
 * queryKey shape: ['videosByIds', ids]
 */
type VideosByIdsQueryKey = ReturnType<typeof queryKeys.videosByIds>;

async function fetchVideosByIds({ queryKey }: QueryFunctionContext): Promise<VideoRecord[]> {
    const [_key, ids] = queryKey as VideosByIdsQueryKey;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
    const { data, error } = await supabase.from('videos').select('*').in('id', ids).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as VideoRecord[];
}

export function useVideosByIds(ids?: string[] | null) {
    // Keep previous data during refetches so UI doesn't briefly clear while
    // favourite/deck ids update. The fetcher already returns an empty array
    // when ids is empty, so it's safe to always enable the query.
    return useQuery<VideoRecord[], Error>({
        queryKey: queryKeys.videosByIds(ids),
        queryFn: fetchVideosByIds,
        enabled: true,
        placeholderData: (previous) => previous,
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
    });
}
