import { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from 'lib/queryKeys';

export function computeNextToggledIds(previous: string[], itemId: string) {
    const exists = previous.includes(itemId);
    const next = exists
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId];

    return {
        exists,
        next,
    };
}

type CreateIdsOnlyToggleMutationLifecycleParams<TVariables> = {
    queryClient: QueryClient;
    primaryKey: QueryKey;
    getNextIds: (previous: string[], variables: TVariables) => string[];
};

export type IdsOnlyToggleMutationContext = {
    previous: string[];
};

export function createIdsOnlyToggleMutationLifecycle<TVariables>({
    queryClient,
    primaryKey,
    getNextIds,
}: CreateIdsOnlyToggleMutationLifecycleParams<TVariables>) {
    return {
        onMutate: async (variables: TVariables): Promise<IdsOnlyToggleMutationContext> => {
            await queryClient.cancelQueries({ queryKey: primaryKey });

            const previous = queryClient.getQueryData<string[]>(primaryKey) || [];
            const next = getNextIds(previous, variables);
            queryClient.setQueryData(primaryKey, next);

            return { previous };
        },
        onError: (_error: unknown, _variables: TVariables, context?: IdsOnlyToggleMutationContext) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(primaryKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: primaryKey });
        },
    };
}
