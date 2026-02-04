import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { showSnack } from 'lib/snackbarService';
import { DECK_LIMIT } from 'constants/Config';

/**
 * useToggleDeck
 * - Toggle a deck entry for current user: insert if missing, delete if present.
 * - Performs optimistic cache updates on ['deck', userId||'current'] which stores an array of video_ids.
 */
export function useToggleDeck(userId?: string | null) {
    const qc = useQueryClient();
    const key = ['deck', userId || 'current'];

    return useMutation({
        mutationFn: async (videoId: string) => {
            // NOTE: development hard-coded id for local testing
            let actualUserId: any = "371b9ee4-3660-4deb-bbfb-b0f7d77e8962";

            // check server-side whether the video exists in deck
            const { data: existing, error: fetchErr } = await supabase
                .from('deck')
                .select('id')
                .eq('video_id', videoId)
                .eq('user_id', actualUserId)
                .maybeSingle();
            if (fetchErr) throw fetchErr;

            if (existing && (existing as any).id) {
                const { error: delErr } = await supabase
                    .from('deck')
                    .delete()
                    .eq('video_id', videoId)
                    .eq('user_id', actualUserId);
                if (delErr) throw delErr;
                return { action: 'deleted' as const };
            }

            // enforce code-level limit
            const { data: rows, error: countErr } = await supabase
                .from('deck')
                .select('video_id', { count: 'exact' })
                .eq('user_id', actualUserId);
            if (countErr) throw countErr;

            const currentCount = Array.isArray(rows) ? rows.length : 0;
            if (currentCount >= DECK_LIMIT) {
                showSnack(`You can only save up to ${DECK_LIMIT} classes.`, { duration: 3000 });
                const err: any = new Error('deck limit reached');
                err.code = 'DECK_LIMIT';
                throw err;
            }

            const { error: insErr } = await supabase.from('deck').insert({ video_id: videoId, user_id: actualUserId });
            if (insErr) throw insErr;
            return { action: 'inserted' as const };
        },
        onMutate: async (videoId: string) => {
            // Optimistic update: update deck cache and remove video from any
            // cached videosByIds entries so UI updates immediately.
            await qc.cancelQueries({ queryKey: key });
            await qc.cancelQueries({ queryKey: ['videosByIds'] });

            const previous = qc.getQueryData<string[]>(key) || [];
            const exists = previous.includes(videoId);
            const next = exists ? previous.filter((id) => id !== videoId) : [...previous, videoId];
            qc.setQueryData(key, next);

            // Snapshot and update videosByIds caches, but only those that match
            // the current deck ids (previous). This prevents removing the video
            // from unrelated lists such as favourites.
            const videosQueries = qc.getQueriesData({ queryKey: ['videosByIds'] }) || [];
            const previousVideos: Record<string, any> = {};
            const prevKeyJson = JSON.stringify(previous);
            for (const [qk] of videosQueries) {
                try {
                    const cacheKey = qk as any;
                    const ids = Array.isArray(cacheKey) ? cacheKey[1] : undefined;
                    // Only modify cached videos lists that have the same ids as the previous deck
                    if (!ids || JSON.stringify(ids) !== prevKeyJson) continue;

                    const old = qc.getQueryData(cacheKey as any);
                    previousVideos[JSON.stringify(cacheKey)] = old;
                    if (Array.isArray(old)) {
                        const filtered = (old as any[]).filter(v => v.id !== videoId);
                        qc.setQueryData(cacheKey as any, filtered);
                    }
                } catch (e) {
                    // ignore
                }
            }

            return { previous, previousVideos };
        },
        onError: (err, _videoId, context: any) => {
            // Rollback
            if (context?.previous) qc.setQueryData(key, context.previous);
            if (context?.previousVideos) {
                for (const k of Object.keys(context.previousVideos)) {
                    try {
                        const parsed = JSON.parse(k);
                        qc.setQueryData(parsed as any, context.previousVideos[k]);
                    } catch (e) {
                        // ignore
                    }
                }
            }
            console.warn('[useToggleDeck] error', err);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: key });
            qc.invalidateQueries({ queryKey: ['videosByIds'] });
        }
    });
}
