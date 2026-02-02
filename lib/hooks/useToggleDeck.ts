import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

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

            // Snapshot and update videosByIds caches
            const videosQueries = qc.getQueriesData({ queryKey: ['videosByIds'] }) || [];
            const previousVideos: Record<string, any> = {};
            for (const [qk] of videosQueries) {
                try {
                    const cacheKey = qk as any;
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
