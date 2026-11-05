import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import { supabase } from '../supabase'
import type { VideoCategoryRecord } from '../models'

export type UserRoadmap = {
    id: string
    user_id: string
    name: string
    description: string | null
    /** True for the user's single default roadmap (opened directly from the Your Roadmaps tab). */
    is_default: boolean
    created_at: string
    updated_at: string
}

/** Same ordering as fetchCategories in useVideoCategories: user order first (nulls last), then system, then name. */
export function sortCategories(categories: VideoCategoryRecord[]): VideoCategoryRecord[] {
    return [...categories].sort((a, b) => {
        const aOrder = a.sort_order ?? Number.POSITIVE_INFINITY
        const bOrder = b.sort_order ?? Number.POSITIVE_INFINITY
        if (aOrder !== bOrder) return aOrder - bOrder
        if (a.system_category !== b.system_category) return a.system_category ? -1 : 1
        return a.name.localeCompare(b.name)
    })
}

async function fetchRoadmaps(userId: string): Promise<UserRoadmap[]> {
    // Categories ride along in the same request and seed the per-roadmap category queries,
    // so screens like Add Video no longer wait for roadmaps *then* categories (two round trips).
    const { data, error } = await supabase
        .from('user_roadmaps')
        .select('*, video_categories(*)')
        .eq('user_id', userId)
        .order('name')
    if (error) throw error
    return (data ?? []).map((row) => {
        const { video_categories: categories, ...roadmap } = row as UserRoadmap & { video_categories?: VideoCategoryRecord[] }
        queryClient.setQueryData(queryKeys.videoCategories(userId, roadmap.id), sortCategories(categories ?? []))
        return roadmap
    })
}

export function useUserRoadmaps() {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.userRoadmaps(user?.id),
        queryFn: () => fetchRoadmaps(user!.id),
        enabled: !loading && !!user?.id,
    })
}

/** The user's default roadmap, if they marked one. `isLoading` mirrors the roadmaps query. */
export function useDefaultRoadmap() {
    const query = useUserRoadmaps()
    return {
        roadmap: query.data?.find((roadmap) => roadmap.is_default) ?? null,
        isLoading: query.isLoading,
    }
}

export function useSetDefaultRoadmap() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: { id: string; isDefault: boolean }) => {
            const userId = requireUserId(undefined, user?.id)
            // Clear any existing default first: a partial unique index allows one default per user.
            const clear = await supabase
                .from('user_roadmaps')
                .update({ is_default: false })
                .eq('user_id', userId)
                .eq('is_default', true)
            if (clear.error) throw clear.error
            if (input.isDefault) {
                const set = await supabase
                    .from('user_roadmaps')
                    .update({ is_default: true })
                    .eq('id', input.id)
                    .eq('user_id', userId)
                if (set.error) throw set.error
            }
            return input
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.userRoadmaps(user?.id) })
        },
    })
}

export function useCreateUserRoadmap() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: { name: string; description?: string | null }) => {
            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase
                .from('user_roadmaps')
                .insert({ user_id: userId, name: input.name.trim(), description: input.description?.trim() || null })
                .select()
                .single()
            if (error) throw error
            return data as UserRoadmap
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.userRoadmaps(user?.id) })
        },
    })
}

export function useUpdateUserRoadmap() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (input: { id: string; name: string; description?: string | null }) => {
            const userId = requireUserId(undefined, user?.id)
            const { data, error } = await supabase
                .from('user_roadmaps')
                .update({ name: input.name.trim(), description: input.description?.trim() || null, updated_at: new Date().toISOString() })
                .eq('id', input.id)
                .eq('user_id', userId)
                .select()
                .single()
            if (error) throw error
            return data as UserRoadmap
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.userRoadmaps(user?.id) })
        },
    })
}

export function useDeleteUserRoadmap() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async (id: string) => {
            const userId = requireUserId(undefined, user?.id)
            const { error } = await supabase.from('user_roadmaps').delete().eq('id', id).eq('user_id', userId)
            if (error) throw error
            return id
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.userRoadmaps(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
        },
    })
}
