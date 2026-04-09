import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from 'lib/auth';
import { VideoIdRow } from 'lib/models';
import { queryKeys } from 'lib/queryKeys';

/**
 * useDeckByUser
 * - Returns the current user's deck as an array of video IDs.
 * - Accepts an optional userId for testing; otherwise resolves from auth or dev env.
 */
type DeckQueryKey = ReturnType<typeof queryKeys.deck>;

async function fetchDeck({ queryKey }: QueryFunctionContext<DeckQueryKey>): Promise<string[]> {
    const [_key, userId] = queryKey;
    if (!userId) return [];

    const { data, error } = await supabase
        .from('deck')
        .select('video_id')
        .eq('user_id', userId);
    if (error) throw error;
    return ((data || []) as VideoIdRow[]).map((r) => r.video_id);
}

export function useDeckByUser(userId?: string | null) {
    const { user, loading } = useAuth();
    const resolvedUserId = userId ?? user?.id ?? null;
    const enabled = !loading && !!resolvedUserId;

    return useQuery({
        queryKey: queryKeys.deck(resolvedUserId),
        queryFn: fetchDeck,
        enabled,
        staleTime: 1000 * 60 * 2,
    });
}
