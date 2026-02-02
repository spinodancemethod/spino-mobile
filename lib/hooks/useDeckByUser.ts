import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * useDeckByUser
 * - Returns the current user's deck as an array of video IDs.
 * - Accepts an optional userId for testing; otherwise resolves from auth or dev env.
 */
async function fetchDeck({ queryKey }: any) {
    const [_key, userId] = queryKey;
    let actualUserId = userId;
    const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID || process.env.DEV_USER_ID || '';
    if (!actualUserId) {
        if (DEV_USER_ID) {
            actualUserId = DEV_USER_ID;
        } else {
            const { data: ud } = await supabase.auth.getUser();
            actualUserId = ud?.user?.id;
        }
    }

    if (!actualUserId) return [];

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
