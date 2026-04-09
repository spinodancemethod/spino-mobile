import { QueryClient, QueryKey } from '@tanstack/react-query';
import { VideoRecord } from 'lib/models';
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

export type ToggleMutationContext = {
    previous: string[];
    previousVideos: Record<string, { queryKey: QueryKey; data: unknown }>;
};

type CreateToggleMutationLifecycleParams = {
    queryClient: QueryClient;
    primaryKey: QueryKey;
    shouldUpdateVideosQuery?: (queryKey: QueryKey, previousIds: string[]) => boolean;
};

type CreateIdsOnlyToggleMutationLifecycleParams<TVariables> = {
    queryClient: QueryClient;
    primaryKey: QueryKey;
    getNextIds: (previous: string[], variables: TVariables) => string[];
};

export type IdsOnlyToggleMutationContext = {
    previous: string[];
};

export function isVideosByIdsQueryForIds(queryKey: QueryKey, ids: string[]) {
    if (!Array.isArray(queryKey) || queryKey[0] !== 'videosByIds') return false;
    const maybeIds = queryKey[1];
    return Array.isArray(maybeIds) && JSON.stringify(maybeIds) === JSON.stringify(ids);
}

export function createToggleMutationLifecycle({
    queryClient,
    primaryKey,
    shouldUpdateVideosQuery,
}: CreateToggleMutationLifecycleParams) {
    const shouldUpdate = shouldUpdateVideosQuery ?? (() => true);

    return {
        onMutate: async (videoId: string): Promise<ToggleMutationContext> => {
            // Shared optimistic lifecycle used by deck/favourite toggles.
            // It updates the ids cache immediately and snapshots related videosByIds caches.
            await queryClient.cancelQueries({ queryKey: primaryKey });
            await queryClient.cancelQueries({ queryKey: queryKeys.videosByIdsRoot() });

            const previous = queryClient.getQueryData<string[]>(primaryKey) || [];
            const { next } = computeNextToggledIds(previous, videoId);
            queryClient.setQueryData(primaryKey, next);

            const previousVideos: Record<string, { queryKey: QueryKey; data: unknown }> = {};
            const videosQueries = queryClient.getQueriesData({ queryKey: queryKeys.videosByIdsRoot() }) || [];

            for (const [qk] of videosQueries) {
                try {
                    const queryKey = qk as QueryKey;
                    if (!shouldUpdate(queryKey, previous)) continue;

                    const old = queryClient.getQueryData(queryKey);
                    previousVideos[JSON.stringify(queryKey)] = { queryKey, data: old };

                    if (Array.isArray(old)) {
                        const filtered = (old as VideoRecord[]).filter((item) => item?.id !== videoId);
                        queryClient.setQueryData(queryKey, filtered);
                    }
                } catch (_error) {
                    // Keep optimistic flow resilient when a cache key cannot be serialized/restored.
                }
            }

            return { previous, previousVideos };
        },
        onError: (_error: unknown, _videoId: string, context?: ToggleMutationContext) => {
            // Roll back ids list and affected videosByIds caches.
            if (context?.previous !== undefined) {
                queryClient.setQueryData(primaryKey, context.previous);
            }

            if (context?.previousVideos) {
                for (const value of Object.values(context.previousVideos)) {
                    queryClient.setQueryData(value.queryKey, value.data);
                }
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: primaryKey });
            queryClient.invalidateQueries({ queryKey: queryKeys.videosByIdsRoot() });
        },
    };
}

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
