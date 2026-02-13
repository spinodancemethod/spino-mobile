import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * React Query fetcher for a single video by id.
 * queryKey shape: ['video', id]
 */
async function fetchVideoById({ queryKey }: any) {
    const [_key, id] = queryKey;
    if (!id) return null;
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export function useVideoById(id?: string | null) {
    return useQuery({
        queryKey: ['video', id],
        queryFn: fetchVideoById,
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    })
}
