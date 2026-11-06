import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import type { VideoCategoryRecord } from '../models'
import { CATEGORY_IMAGE_BUCKET, newCategoryImagePath } from '../categoryImage'

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
        // User-set order first (nulls last), then the legacy order (system first, by name).
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('system_category', { ascending: false })
        .order('name')
    if (error) throw error
    return (data ?? []) as VideoCategoryRecord[]
}

export function useVideoCategories(roadmapId?: string | null) {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoCategories(user?.id, roadmapId),
        queryFn: () => fetchCategories(roadmapId!),
        enabled: !loading && !!user?.id && !!roadmapId,
    })
}

export function useCreateVideoCategory() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: CreateVideoCategoryInput) => {
            const userId = requireUserId(undefined, user?.id)
            const trimmedName = input.name.trim()
            if (!trimmedName) throw new Error('Category name is required.')
            if (!input.roadmapId) throw new Error('Roadmap is required to create a category.')

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
            if (!trimmedName) throw new Error('Category name is required.')

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
            // Drop the tile image first (best effort) so the bucket does not collect orphans.
            const cached = queryClient.getQueryData<VideoCategoryRecord[]>(queryKeys.videoCategories(userId, roadmapId))
            const imagePath = cached?.find((c) => c.id === id)?.image_path
            if (imagePath) await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([imagePath])
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

/**
 * Fable v2 Prompt 10: copy the dance-style position library into a roadmap's
 * categories (user-owned, tagged with position_slug). Idempotent; returns how many
 * were added.
 */
export function useApplyPositionLibrary() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: { roadmapId: string; danceStyle: 'bachata' | 'salsa' }) => {
            const { data, error } = await supabase.rpc('apply_position_library', {
                p_roadmap_id: input.roadmapId,
                p_dance_style: input.danceStyle,
            })
            if (error) throw error
            return (data as number) ?? 0
        },
        onSuccess: (_added, input) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, input.roadmapId) })
        },
    })
}

/**
 * Persist a new vertical order of the categories of one roadmap (roadmap drag).
 * Optimistic: the cache is reordered at once; the rows get sort_order = index * 10.
 */
export function useReorderVideoCategories() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ roadmapId, orderedIds }: { roadmapId: string; orderedIds: string[] }) => {
            // RPC rather than per-row updates: the per-roadmap system category (Misc) is
            // not user-owned, so a client update on it would be a silent no-op under RLS.
            const { error } = await supabase.rpc('reorder_video_categories', { p_roadmap_id: roadmapId, p_ids: orderedIds })
            if (error) throw error
        },
        onMutate: async ({ roadmapId, orderedIds }) => {
            const key = queryKeys.videoCategories(user?.id, roadmapId)
            await queryClient.cancelQueries({ queryKey: key })
            const previous = queryClient.getQueryData<VideoCategoryRecord[]>(key)
            if (previous) {
                const byId = new Map(previous.map((c) => [c.id, c]))
                const next = orderedIds.map((id, index) => ({ ...byId.get(id)!, sort_order: index * 10 })).filter(Boolean)
                queryClient.setQueryData(key, next)
            }
            return { previous, key }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
        },
        onSettled: (_d, _e, { roadmapId }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, roadmapId) })
        },
    })
}

/** Persist image_path on the row and refresh the roadmap tiles. */
async function saveCategoryImagePath(userId: string, category: VideoCategoryRecord, imagePath: string | null) {
    const { data, error } = await supabase
        .from('video_categories')
        .update({ image_path: imagePath, updated_at: new Date().toISOString() })
        .eq('id', category.id)
        .eq('roadmap_id', category.roadmap_id)
        .eq('user_id', userId)
        .select()
        .single()
    if (error) throw error
    return data as VideoCategoryRecord
}

/**
 * Upload a picked image to the public category-images bucket and point the
 * category at it. The old object (if any) is removed afterwards. The system
 * Misc category is not user-owned, so RLS rejects the row update for it.
 */
export function useSetCategoryImage() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ category, uri, mimeType }: { category: VideoCategoryRecord; uri: string; mimeType?: string | null }) => {
            const userId = requireUserId(undefined, user?.id)
            if (category.system_category) throw new Error('The Misc category cannot have an image.')
            const contentType = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
            const path = newCategoryImagePath(userId, category.id, contentType)
            const body = await (await fetch(uri)).arrayBuffer()
            const { error: upErr } = await supabase.storage.from(CATEGORY_IMAGE_BUCKET).upload(path, body, { contentType, upsert: false })
            if (upErr) throw upErr
            let updated: VideoCategoryRecord
            try {
                updated = await saveCategoryImagePath(userId, category, path)
            } catch (error) {
                // Row update failed: do not leave the fresh object behind.
                await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([path])
                throw error
            }
            if (category.image_path && category.image_path !== path) {
                await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([category.image_path])
            }
            return updated
        },
        onSuccess: (category) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, category.roadmap_id) })
        },
    })
}

/** Clear the category image and delete the stored object. */
export function useRemoveCategoryImage() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ category }: { category: VideoCategoryRecord }) => {
            const userId = requireUserId(undefined, user?.id)
            const updated = await saveCategoryImagePath(userId, category, null)
            if (category.image_path) await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([category.image_path])
            return updated
        },
        onSuccess: (category) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoCategories(user?.id, category.roadmap_id) })
        },
    })
}
