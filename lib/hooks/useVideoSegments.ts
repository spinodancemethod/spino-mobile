import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import type { SegmentRecord, VideoCategoryRecord } from '../models'

export type CreateSegmentInput = {
    videoUploadId: string
    startTime: number
    endTime: number
    categoryId: string
    title?: string | null
    description?: string | null
    thumbnailReference?: string | null
}

export type UpdateSegmentInput = {
    id: string
    videoUploadId: string
    startTime: number
    endTime: number
    categoryId: string
    title?: string | null
    description?: string | null
    thumbnailReference?: string | null
}

function cleanOptionalText(value?: string | null): string | null {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

async function fetchCategories(): Promise<VideoCategoryRecord[]> {
    const { data, error } = await supabase
        .from('video_categories')
        .select('*')
        .order('system_category', { ascending: false })
        .order('name')
    if (error) throw error
    return (data ?? []) as VideoCategoryRecord[]
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

export function useVideoCategories() {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoCategories(user?.id),
        queryFn: fetchCategories,
        enabled: !loading && !!user?.id,
    })
}

export function useVideoSegments(videoUploadId: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.segments(user?.id, videoUploadId),
        queryFn: () => fetchSegments(user!.id, videoUploadId!),
        enabled: !loading && !!user?.id && !!videoUploadId,
    })
}

export function useCreateVideoCategory() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (name: string) => {
            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase
                .from('video_categories')
                .insert({ user_id: userId, name: name.trim(), system_category: false })
                .select()
                .single()
            if (error) throw error
            return data as VideoCategoryRecord
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id) })
        },
    })
}

export function useCreateVideoSegment() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: CreateSegmentInput) => {
            const userId = requireUserId(undefined, user?.id)
            if (input.startTime < 0 || input.startTime >= input.endTime) {
                throw new Error('Segment start time must be less than end time.')
            }
            const { data, error } = await supabase
                .from('segments')
                .insert({
                    user_id: userId,
                    video_upload_id: input.videoUploadId,
                    start_time: input.startTime,
                    end_time: input.endTime,
                    category_id: input.categoryId,
                    title: cleanOptionalText(input.title),
                    description: cleanOptionalText(input.description),
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
        },
    })
}

export function useUpdateVideoSegment() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: UpdateSegmentInput) => {
            const userId = requireUserId(undefined, user?.id)
            if (input.startTime < 0 || input.startTime >= input.endTime) {
                throw new Error('Segment start time must be less than end time.')
            }
            const { data, error } = await supabase
                .from('segments')
                .update({
                    start_time: input.startTime,
                    end_time: input.endTime,
                    category_id: input.categoryId,
                    title: cleanOptionalText(input.title),
                    description: cleanOptionalText(input.description),
                    thumbnail_reference: cleanOptionalText(input.thumbnailReference),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', input.id)
                .eq('user_id', userId)
                .select()
                .single()
            if (error) throw error
            return data as SegmentRecord
        },
        onSuccess: (segment) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments(user?.id, segment.video_upload_id) })
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
        },
    })
}
