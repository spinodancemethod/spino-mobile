import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * useFavouritesByUser
 * - Returns the current user's favourites as an array of video IDs (or full rows when needed).
 * - Accepts an optional userId (useful for dev/testing). When not provided, reads from supabase.auth.getUser().
 */
async function fetchFavourites({ queryKey }: any) {
    // queryKey shape: ['favourites', userIdOrCurrent]
    const [_key, userId] = queryKey;

    // Development: use a fixed hard-coded user id so queries and mutations
    // operate against the same test user.
    const actualUserId = '371b9ee4-3660-4deb-bbfb-b0f7d77e8962';

    // Query the `favourites` table for this user and return an array of video_ids.
    const { data, error } = await supabase
        .from('favourites')
        .select('video_id')
        .eq('user_id', actualUserId);
    if (error) throw error;
    return (data || []).map((r: any) => r.video_id);
}

export function useFavouritesByUser(userId?: string | null) {
    const enabled = !!(userId || true); // we always try to resolve the current user if none supplied
    return useQuery({
        queryKey: ['favourites', userId || 'current'],
        queryFn: fetchFavourites,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
