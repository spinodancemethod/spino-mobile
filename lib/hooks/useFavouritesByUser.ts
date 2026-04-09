import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from 'lib/auth';
import { VideoIdRow } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';
import { resolveUserId } from './userId';

/**
 * useFavouritesByUser
 * - Returns the current user's favourites as an array of video IDs (or full rows when needed).
 * - Accepts an optional userId (useful for dev/testing). When not provided, uses auth context user id.
 */
type FavouritesQueryKey = ReturnType<typeof queryKeys.favourites>;

async function fetchFavourites({ queryKey }: QueryFunctionContext<FavouritesQueryKey>): Promise<string[]> {
    // queryKey shape: ['favourites', userIdOrCurrent]
    const [_key, userId] = queryKey;

    const actualUserId = userId ?? null;

    if (!actualUserId) return [];

    // Query the `favourites` table for this user and return an array of video_ids.
    const { data, error } = await supabase
        .from('favourites')
        .select('video_id')
        .eq('user_id', actualUserId);
    if (error) throw error;
    return ((data || []) as VideoIdRow[]).map((r) => r.video_id);
}

export function useFavouritesByUser(userId?: string | null) {
    const { user, loading } = useAuth();
    const resolvedUserId = resolveUserId(userId, user?.id);
    const enabled = !loading && !!resolvedUserId;

    return useQuery({
        queryKey: queryKeys.favourites(resolvedUserId),
        queryFn: fetchFavourites,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
