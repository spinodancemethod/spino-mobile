import { useMutation } from '@tanstack/react-query'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { supabase } from '../supabase'
import type { CreateVideoPayload } from '../models'

export function useCreateVideo() {
    return useMutation({
        mutationFn: async (payload: CreateVideoPayload) => {
            const { data, error } = await supabase
                .from('videos')
                .insert(payload)
                .select()
                .single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
        },
    })
}
