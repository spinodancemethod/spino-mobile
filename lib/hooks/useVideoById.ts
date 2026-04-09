import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';
import { supabase } from '../supabase';

/**
 * React Query fetcher for a single video by id.
 * queryKey shape: ['video', id]
 */
type VideoByIdQueryKey = ReturnType<typeof queryKeys.video>;

async function fetchVideoById({ queryKey }: QueryFunctionContext): Promise<VideoRecord | null> {
    const [_key, id] = queryKey as VideoByIdQueryKey;
    if (!id) return null;
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();
    if (error) throw error;
    return (data || null) as VideoRecord | null;
}

export function useVideoById(id?: string | null) {
    return useQuery<VideoRecord | null, Error>({
        queryKey: queryKeys.video(id),
        queryFn: fetchVideoById,
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    })
}
