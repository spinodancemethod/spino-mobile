import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/*
    Hook: usePositions

    - Returns a list of positions (used to populate the category selector).
    - Supports optional filtering by `position` (category) and `search` term.
    - Uses React Query to cache results and avoid unnecessary network requests.
*/
async function fetchPositions({ queryKey }: any) {
    const [_key, params] = queryKey;
    const { position, search } = params || {};
    let builder: any = supabase.from('positions').select('*');
    if (position) builder = builder.eq('category', position);
    if (search) builder = builder.ilike('name', `%${search}%`);
    const { data, error } = await builder;
    if (error) throw error;
    return data;
}

export function usePositions(params: { position?: string | null; search?: string } | undefined) {
    return useQuery({ queryKey: ['positions', params], queryFn: fetchPositions });
}

