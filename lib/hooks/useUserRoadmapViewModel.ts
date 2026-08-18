import { useMemo } from 'react'
import { useRoadmapSegments } from './useRoadmapSegments'
import { useVideoCategories } from './useVideoCategories'
import { useCompletedSegmentIdsByUser } from './useCompletedSegmentIdsByUser'
import type { RoadmapPosition, RoadmapVideo } from 'Components/roadmap/types'

export function useUserRoadmapViewModel(
    roadmapId: string | null | undefined,
    showEmptyCategories: boolean,
    showCompleted: boolean,
) {
    const segmentsQuery = useRoadmapSegments(roadmapId)
    const categoriesQuery = useVideoCategories(roadmapId)
    const completedSegmentsQuery = useCompletedSegmentIdsByUser()

    const roadmapPosition = useMemo<RoadmapPosition[]>(() => (
        (categoriesQuery.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description ?? null,
        }))
    ), [categoriesQuery.data])

    const videosByCategory = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()
        for (const segment of segmentsQuery.data ?? []) {
            const categoryVideos = grouped.get(segment.category_id) ?? []
            categoryVideos.push({
                id: segment.id,
                title: (segment.title?.trim() || segment.video_name) ?? segment.video_filename ?? null,
                note_text: segment.note_text,
                thumbnail_url: segment.video_thumbnail,
                video_upload_id: segment.video_upload_id,
                start_time: segment.start_time,
                end_time: segment.end_time,
                category_name: segment.category_name,
            })
            grouped.set(segment.category_id, categoryVideos)
        }
        return grouped
    }, [segmentsQuery.data])

    const completedSegmentIdSet = useMemo(
        () => new Set(completedSegmentsQuery.data ?? []),
        [completedSegmentsQuery.data]
    )

    const filteredVideosByCategory = useMemo(() => {
        if (showCompleted) return videosByCategory
        const filtered = new Map<string, RoadmapVideo[]>()
        for (const [categoryId, videos] of videosByCategory.entries()) {
            filtered.set(categoryId, videos.filter((video) => !video?.id || !completedSegmentIdSet.has(video.id)))
        }
        return filtered
    }, [videosByCategory, showCompleted, completedSegmentIdSet])

    const categoryRows = useMemo(() => {
        if (roadmapPosition.length > 0) {
            if (showEmptyCategories) return roadmapPosition
            return roadmapPosition.filter((category) => (filteredVideosByCategory.get(category.id)?.length ?? 0) > 0)
        }
        return Array.from(filteredVideosByCategory.keys()).map((id) => ({ id, name: 'Category' }))
    }, [roadmapPosition, filteredVideosByCategory, showEmptyCategories])

    return {
        segmentsQuery,
        categoriesQuery,
        completedSegmentsQuery,
        categoryRows,
        filteredVideosByCategory,
        completedSegmentIdSet,
        emptyVideos: EMPTY_VIDEOS,
    }
}

const EMPTY_VIDEOS = new Map<string, RoadmapVideo[]>()
