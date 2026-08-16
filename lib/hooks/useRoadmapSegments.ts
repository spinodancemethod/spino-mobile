import { useQuery } from '@tanstack/react-query'
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
                .select('id, user_id, video_upload_id, start_time, end_time, category_id, title, thumbnail_reference, video_categories!inner(name), video_uploads!inner(name, filename, custom_title, fallback_uri, thumbnail_reference, roadmap_id, video_upload_notes(note_text))')
                .eq('user_id', user!.id)
                .eq('video_uploads.roadmap_id', roadmapId!)
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
