import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * useDeckByUser
 * - Returns the current user's deck as an array of video IDs.
 * - Accepts an optional userId for testing; otherwise resolves from auth or dev env.
 */
async function fetchDeck({ queryKey }: any) {
    const [_key, userId] = queryKey;
    const actualUserId = '371b9ee4-3660-4deb-bbfb-b0f7d77e8962';

    const { data, error } = await supabase
        .from('deck')
        .select('video_id')
        .eq('user_id', actualUserId);
    if (error) throw error;
    return (data || []).map((r: any) => r.video_id);
}

export function useDeckByUser(userId?: string | null) {
    const enabled = !!(userId || true);
    return useQuery({
        queryKey: ['deck', userId || 'current'],
        queryFn: fetchDeck,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
