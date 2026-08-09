import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { requireUserId } from './userId'
import { supabase } from '../supabase'

export type UserRoadmap = {
    id: string
    user_id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
}

async function fetchRoadmaps(userId: string): Promise<UserRoadmap[]> {
    const { data, error } = await supabase
        .from('user_roadmaps')
        .select('*')
        .eq('user_id', userId)
        .order('name')
    if (error) throw error
    return (data ?? []) as UserRoadmap[]
}

export function useUserRoadmaps() {
    const { user, loading } = useAuth()
    return useQuery({
        queryKey: queryKeys.userRoadmaps(user?.id),
        queryFn: () => fetchRoadmaps(user!.id),
        enabled: !loading && !!user?.id,
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
