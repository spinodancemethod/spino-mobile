import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
import { queryKeys, VideosParams } from 'lib/queryKeys';
import { supabase } from '../supabase';

/*
    Hook: useVideos

    - Fetches rows from the `videos` table.
    - Accepts an optional params object with `positionId` to filter results.
    - The query is disabled unless `positionId` is provided (avoids fetching all videos on app start).
    - React Query options set `staleTime` so results are treated as fresh for a short period and
        unnecessary refetches are avoided.
*/

type VideosQueryKey = ReturnType<typeof queryKeys.videos>;

async function fetchVideos({ queryKey }: QueryFunctionContext): Promise<VideoRecord[]> {
    const [_key, params] = queryKey as VideosQueryKey;
    const { positionId, isPosition } = (params || {}) as VideosParams;

    let builder = supabase.from('videos').select('*');
    if (positionId) builder = builder.eq('position_id', positionId);
    if (typeof isPosition === 'boolean') builder = builder.eq('is_position', isPosition);
    // optional: order by created_at desc
    builder = builder.order('created_at', { ascending: false });

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []) as VideoRecord[];
}

export function useVideos(params: VideosParams | undefined) {
    const enabled = !!(params && params.positionId);
    return useQuery<VideoRecord[], Error>({
        queryKey: queryKeys.videos(params),
        queryFn: fetchVideos,
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}
