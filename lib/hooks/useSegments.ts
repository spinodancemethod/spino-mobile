import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import type { SegmentRecord } from '../models'

const MAX_SEGMENT_TIME_WITHOUT_DURATION = 24 * 60 * 60

export type CreateSegmentInput = {
    videoUploadId: string
    startTime: number
    endTime: number
    durationSeconds?: number | null
    categoryId: string
    title?: string | null
    userNotes?: string | null
    thumbnailReference?: string | null
}

export type UpdateSegmentInput = {
    id: string
    videoUploadId: string
    startTime: number
    endTime: number
    durationSeconds?: number | null
    categoryId?: string | null
    title?: string | null
    userNotes?: string | null
    thumbnailReference?: string | null
}

function cleanOptionalText(value?: string | null): string | null {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

export function validateSegmentRange(startTime: number, endTime: number, durationSeconds?: number | null): string | null {
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || startTime >= endTime) {
        return 'Enter a valid segment range where start is less than end.'
    }

    const hasDuration = Number.isFinite(durationSeconds) && (durationSeconds ?? 0) > 0
    const maximumEndTime = hasDuration ? durationSeconds! : MAX_SEGMENT_TIME_WITHOUT_DURATION
    if (endTime > maximumEndTime) {
        return hasDuration
            ? `Segment end time cannot exceed the video duration of ${maximumEndTime} seconds.`
            : 'Segment times cannot exceed 24 hours when video duration is unavailable.'
    }

    return null
}

async function fetchSegments(userId: string, videoUploadId: string): Promise<SegmentRecord[]> {
    const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('user_id', userId)
        .eq('video_upload_id', videoUploadId)
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at')
    if (error) throw error
    return (data ?? []) as SegmentRecord[]
}

export function useVideoSegments(videoUploadId: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.segments(user?.id, videoUploadId),
        queryFn: () => fetchSegments(user!.id, videoUploadId!),
        enabled: !loading && !!user?.id && !!videoUploadId,
    })
}

export function useCreateVideoSegment() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: CreateSegmentInput) => {
            const userId = requireUserId(undefined, user?.id)
            const validationError = validateSegmentRange(input.startTime, input.endTime, input.durationSeconds)
            if (validationError) throw new Error(validationError)
            const { data, error } = await supabase
                .from('segments')
                .insert({
                    user_id: userId,
                    video_upload_id: input.videoUploadId,
                    start_time: input.startTime,
                    end_time: input.endTime,
                    category_id: input.categoryId,
                    title: cleanOptionalText(input.title),
                    user_notes: cleanOptionalText(input.userNotes),
                    thumbnail_reference: cleanOptionalText(input.thumbnailReference),
                    user_confirmed: true,
                    ai_generated: false,
                })
                .select()
                .single()
            if (error) throw error
            return data as SegmentRecord
        },
        onSuccess: (segment) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments(user?.id, segment.video_upload_id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoSegmentCounts(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        },
    })
}

export function useUpdateVideoSegment() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: UpdateSegmentInput) => {
            const userId = requireUserId(undefined, user?.id)
            const validationError = validateSegmentRange(input.startTime, input.endTime, input.durationSeconds)
            if (validationError) throw new Error(validationError)
            const updates: Record<string, unknown> = {
                start_time: input.startTime,
                end_time: input.endTime,
                updated_at: new Date().toISOString(),
            }
            if (input.categoryId !== undefined) updates.category_id = input.categoryId
            if (input.title !== undefined) updates.title = cleanOptionalText(input.title)
            if (input.userNotes !== undefined) updates.user_notes = cleanOptionalText(input.userNotes)
            if (input.thumbnailReference !== undefined) updates.thumbnail_reference = cleanOptionalText(input.thumbnailReference)

            const { data, error } = await supabase
                .from('segments')
                .update(updates)
                .eq('id', input.id)
                .eq('user_id', userId)
                .select()
                .single()
            if (error) throw error
            return data as SegmentRecord
        },
        onSuccess: (segment) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments(user?.id, segment.video_upload_id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoSegmentCounts(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        },
    })
}

export function useDeleteVideoSegment() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (segment: Pick<SegmentRecord, 'id' | 'video_upload_id'>) => {
            const userId = requireUserId(undefined, user?.id)
            const { error } = await supabase
                .from('segments')
                .delete()
                .eq('id', segment.id)
                .eq('user_id', userId)
            if (error) throw error
            return segment
        },
        onSuccess: (segment) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments(user?.id, segment.video_upload_id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoSegmentCounts(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        },
    })
}
