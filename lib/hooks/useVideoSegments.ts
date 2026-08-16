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
    thumbnailReference?: string | null
}

export type UpdateSegmentInput = {
    id: string
    videoUploadId: string
    startTime: number
    endTime: number
    categoryId?: string | null
    title?: string | null
    thumbnailReference?: string | null
}

export type CreateVideoCategoryInput = {
    roadmapId: string
    name: string
    description?: string | null
}

function cleanOptionalText(value?: string | null): string | null {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

async function fetchCategories(roadmapId: string): Promise<VideoCategoryRecord[]> {
    const { data, error } = await supabase
        .from('video_categories')
        .select('*')
        .eq('roadmap_id', roadmapId)
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

export function useVideoCategories(roadmapId?: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoCategories(user?.id, roadmapId),
        queryFn: () => fetchCategories(roadmapId!),
        enabled: !loading && !!user?.id && !!roadmapId,
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
        mutationFn: async (input: CreateVideoCategoryInput) => {
            const userId = requireUserId(undefined, user?.id)
            const trimmedName = input.name.trim()
            if (!trimmedName) {
                throw new Error('Category name is required.')
            }
            if (!input.roadmapId) {
                throw new Error('Roadmap is required to create a category.')
            }

            const { data, error } = await supabase
                .from('video_categories')
                .insert({
                    user_id: userId,
                    roadmap_id: input.roadmapId,
                    name: trimmedName,
                    description: cleanOptionalText(input.description),
                    system_category: false,
                })
                .select()
                .single()
            if (error) throw error
            return data as VideoCategoryRecord
        },
        onSuccess: (category) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, category.roadmap_id) })
        },
    })
}

export function useUpdateVideoCategory() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ id, roadmapId, name, description }: { id: string; roadmapId: string; name: string; description?: string | null }) => {
            const userId = requireUserId(undefined, user?.id)
            const trimmedName = name.trim()
            if (!trimmedName) {
                throw new Error('Category name is required.')
            }

            const { data, error } = await supabase
                .from('video_categories')
                .update({
                    name: trimmedName,
                    description: cleanOptionalText(description),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('roadmap_id', roadmapId)
                .eq('user_id', userId)
                .select()
                .single()

            if (error) throw error
            return data as VideoCategoryRecord
        },
        onSuccess: (category) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, category.roadmap_id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments() })
        },
    })
}

export function useDeleteVideoCategory() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ id, roadmapId }: { id: string; roadmapId: string }) => {
            const userId = requireUserId(undefined, user?.id)
            const { error } = await supabase
                .from('video_categories')
                .delete()
                .eq('id', id)
                .eq('roadmap_id', roadmapId)
                .eq('user_id', userId)

            if (error) throw error
            return { id, roadmapId }
        },
        onSuccess: ({ roadmapId }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, roadmapId) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
            void queryClient.invalidateQueries({ queryKey: queryKeys.segments() })
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
            // Keep roadmap canvas in sync when returning from Add Video.
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
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
            const updates: Record<string, unknown> = {
                start_time: input.startTime,
                end_time: input.endTime,
                updated_at: new Date().toISOString(),
            }
            if (input.categoryId !== undefined) updates.category_id = input.categoryId
            if (input.title !== undefined) updates.title = cleanOptionalText(input.title)
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
            void queryClient.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        },
    })
}
