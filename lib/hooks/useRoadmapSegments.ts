import { useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '../queryClient'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { queryKeys } from '../queryKeys'

export type RoadmapSegment = {
    id: string
    user_id: string
    video_upload_id: string
    start_time: number
    end_time: number
    category_id: string
    category_name: string
    sequence: number | null
    title: string | null
    note_text: string | null
    video_name: string | null
    video_filename: string | null
    video_uri: string | null
    video_thumbnail: string | null
}

export function useRoadmapSegments(roadmapId?: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.roadmapSegments(roadmapId, user?.id),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('segments')
                .select('id, user_id, video_upload_id, sequence, start_time, end_time, category_id, title, thumbnail_reference, video_categories!inner(name), video_uploads!inner(name, filename, custom_title, fallback_uri, thumbnail_reference, roadmap_id, video_upload_notes(note_text))')
                .eq('user_id', user!.id)
                .eq('video_uploads.roadmap_id', roadmapId!)
                // User-set order within a category first (nulls last), then by time.
                .order('sequence', { ascending: true, nullsFirst: false })
                .order('start_time')

            if (error) throw error
            return (data ?? []).map((row: any) => {
                // Supabase relation can be array/object depending on inferred cardinality.
                // Normalize to a single nullable note string for UI consumption.
                const notesRelation = row.video_uploads?.video_upload_notes
                const noteText = Array.isArray(notesRelation)
                    ? (notesRelation[0]?.note_text ?? null)
                    : (notesRelation?.note_text ?? null)

                const displayTitle = row.video_uploads?.custom_title?.trim() || null
                const filename = row.video_uploads?.filename?.trim() || null
                const legacyName = row.video_uploads?.name?.trim() || null

                return {
                    id: row.id,
                    user_id: row.user_id,
                    video_upload_id: row.video_upload_id,
                    start_time: row.start_time,
                    end_time: row.end_time,
                    category_id: row.category_id,
                    sequence: row.sequence ?? null,
                    category_name: row.video_categories?.name ?? 'Misc',
                    title: row.title ?? null,
                    note_text: noteText,
                    video_name: displayTitle ?? legacyName,
                    video_filename: filename,
                    video_uri: row.video_uploads?.fallback_uri ?? null,
                    video_thumbnail: row.thumbnail_reference ?? row.video_uploads?.thumbnail_reference ?? null,
                }
            }) as RoadmapSegment[]
        },
        enabled: !loading && !!user?.id && !!roadmapId,
    })
}

/**
 * Persist a new left-to-right order of the segments in one category (roadmap drag).
 * Optimistic: the cache is reordered at once; rows get sequence = index * 10.
 */
export function useReorderRoadmapSegments() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ orderedIds }: { roadmapId: string; orderedIds: string[] }) => {
            const results = await Promise.all(orderedIds.map((id, index) =>
                supabase.from('segments').update({ sequence: index * 10 }).eq('id', id).eq('user_id', user!.id),
            ))
            const failed = results.find((r) => r.error)
            if (failed?.error) throw failed.error
        },
        onMutate: async ({ roadmapId, orderedIds }) => {
            const key = queryKeys.roadmapSegments(roadmapId, user?.id)
            await queryClient.cancelQueries({ queryKey: key })
            const previous = queryClient.getQueryData<RoadmapSegment[]>(key)
            if (previous) {
                const rank = new Map(orderedIds.map((id, index) => [id, index * 10]))
                const next = previous
                    .map((seg) => (rank.has(seg.id) ? { ...seg, sequence: rank.get(seg.id)! } : seg))
                    // Keep the array in display order so the canvas re-renders in the new order
                    // (the canvas groups by category, so cross-category order is irrelevant).
                    .sort((a, b) => a.category_id.localeCompare(b.category_id)
                        || ((a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER))
                        || (a.start_time - b.start_time))
                queryClient.setQueryData(key, next)
            }
            return { previous, key }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
        },
        onSettled: (_d, _e, { roadmapId }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegments(roadmapId, user?.id) })
        },
    })
}
