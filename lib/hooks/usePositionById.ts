import { QueryFunctionContext, useQuery } from '@tanstack/react-query'
import { PositionRecord } from 'lib/models'
import { queryKeys } from 'lib/queryKeys'
import { supabase } from 'lib/supabase'

type PositionByIdQueryKey = ReturnType<typeof queryKeys.position>

async function fetchPositionById({ queryKey }: QueryFunctionContext): Promise<PositionRecord | null> {
    const [_key, id] = queryKey as PositionByIdQueryKey

    if (!id) return null

    const { data, error } = await supabase
        .from('positions')
        // Keep this aligned with the actual `positions` table columns.
        .select('id, name, description, access_tier')
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
        ...(data as PositionRecord),
        // Keep name non-null so downstream UI does not need fallback checks.
        name: (data as any).name ?? (data as any).title ?? 'Unknown position',
    }
}

export function usePositionById(id?: string | null) {
    return useQuery<PositionRecord | null, Error>({
        queryKey: queryKeys.position(id),
        queryFn: fetchPositionById,
        enabled: !!id,
    })
}
