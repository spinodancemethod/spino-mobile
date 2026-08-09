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
    description: string | null
    video_name: string | null
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
                .select('id, user_id, video_upload_id, start_time, end_time, category_id, title, description, thumbnail_reference, video_categories!inner(name), video_uploads!inner(name, fallback_uri, thumbnail_reference, roadmap_id)')
                .eq('user_id', user!.id)
                .eq('video_uploads.roadmap_id', roadmapId!)
                .order('start_time')

            if (error) throw error
            return (data ?? []).map((row: any) => ({
                id: row.id,
                user_id: row.user_id,
                video_upload_id: row.video_upload_id,
                start_time: row.start_time,
                end_time: row.end_time,
                category_id: row.category_id,
                category_name: row.video_categories?.name ?? 'Misc',
                title: row.title ?? null,
                description: row.description ?? null,
                video_name: row.video_uploads?.name ?? null,
                video_uri: row.video_uploads?.fallback_uri ?? null,
                video_thumbnail: row.thumbnail_reference ?? row.video_uploads?.thumbnail_reference ?? null,
            })) as RoadmapSegment[]
        },
        enabled: !loading && !!user?.id && !!roadmapId,
    })
}
