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

    // Resolve the actual user id to query favourites for. The resolution order is:
    // 1) explicit `userId` supplied to the query key
    // 2) DEV user id from process.env (build-time)
    // 3) current authenticated user via supabase.auth.getUser()
    // This lets local dev use EXPO_PUBLIC_DEV_USER_ID while still working in prod.
    let actualUserId = userId;
    const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID || process.env.DEV_USER_ID || '';
    if (!actualUserId) {
        if (DEV_USER_ID) {
            // Development convenience — use this id when set (e.g. via app config extras)
            actualUserId = DEV_USER_ID;
        } else {
            // No dev id provided — fall back to the authenticated session (if any)
            const { data: ud } = await supabase.auth.getUser();
            actualUserId = ud?.user?.id;
        }
    }

    // If we still don't have a user id (no dev id and no auth), return empty list.
    if (!actualUserId) return [];

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
