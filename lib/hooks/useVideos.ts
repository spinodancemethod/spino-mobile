import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/*
    Hook: useVideos

    - Fetches rows from the `videos` table.
    - Accepts an optional params object with `positionId` to filter results.
    - The query is disabled unless `positionId` is provided (avoids fetching all videos on app start).
    - React Query options set `staleTime` so results are treated as fresh for a short period and
        unnecessary refetches are avoided.
*/

async function fetchVideos({ queryKey }: any) {
    const [_key, params] = queryKey;
    const { positionId } = params || {};

    let builder: any = supabase.from('videos').select('*');
    if (positionId) builder = builder.eq('position_id', positionId);
    // optional: order by created_at desc
    builder = builder.order('created_at', { ascending: false });

    const { data, error } = await builder;
    if (error) throw error;
    return data;
}

export function useVideos(params: { positionId?: string | null } | undefined) {
    const enabled = !!(params && params.positionId);
    return useQuery({
        queryKey: ['videos', params],
        queryFn: fetchVideos,
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
}
