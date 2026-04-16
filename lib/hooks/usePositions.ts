import { QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { PositionRecord } from 'lib/models';
import { queryKeys, PositionsParams } from 'lib/queryKeys';
import { supabase } from '../supabase';

/*
    Hook: usePositions

    - Returns a list of positions (used to populate the category selector).
    - Supports optional filtering by `position` (category) and `search` term.
    - Uses React Query to cache results and avoid unnecessary network requests.
*/
type PositionsQueryKey = ReturnType<typeof queryKeys.positions>;

async function fetchPositions({ queryKey }: QueryFunctionContext): Promise<PositionRecord[]> {
    const [_key, params] = queryKey as PositionsQueryKey;
    const { position, search } = (params || {}) as PositionsParams;
    let builder = supabase.from('positions').select('*').order('order', { ascending: true });
    if (position) builder = builder.eq('category', position);
    if (search) builder = builder.ilike('name', `%${search}%`);
    const { data, error } = await builder;
    if (error) throw error;

    return ((data || []) as Array<PositionRecord & { name?: string | null }>).map((row) => ({
        ...row,
        // Keep `name` non-null for shared filter/dropdown consumers.
        name: row.name ?? row.title ?? 'Unknown position',
    }));
}

export function usePositions(params: PositionsParams | undefined) {
    return useQuery<PositionRecord[], Error>({
        queryKey: queryKeys.positions(params),
        queryFn: fetchPositions,
    });
}

