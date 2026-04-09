import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from 'lib/auth';
import { VideoIdRow } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';

/**
 * useFavouritesByUser
 * - Returns the current user's favourites as an array of video IDs (or full rows when needed).
 * - Accepts an optional userId (useful for dev/testing). When not provided, reads from supabase.auth.getUser().
 */
type FavouritesQueryKey = ReturnType<typeof queryKeys.favourites>;

async function fetchFavourites({ queryKey }: QueryFunctionContext<FavouritesQueryKey>): Promise<string[]> {
    // queryKey shape: ['favourites', userIdOrCurrent]
    const [_key, userId] = queryKey;

    // Prefer explicit userId (useful for testing); otherwise resolve the
    // currently authenticated user via Supabase.
    let actualUserId: string | null = userId ?? null;
    if (!actualUserId) {
        const { data: ud, error: ue } = await supabase.auth.getUser();
        if (ue) throw ue;
        actualUserId = ud?.user?.id ?? null;
    }

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
    const resolvedUserId = userId ?? user?.id ?? null;
    const enabled = !loading && !!resolvedUserId;

    return useQuery({
        queryKey: queryKeys.favourites(resolvedUserId),
        queryFn: fetchFavourites,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
