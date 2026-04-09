import { describe, expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import {
    computeNextToggledIds,
    createIdsOnlyToggleMutationLifecycle,
    isVideosByIdsQueryForIds,
} from './toggleMutationUtils';

describe('computeNextToggledIds', () => {
    it('adds item when not present', () => {
        const { exists, next } = computeNextToggledIds(['a', 'b'], 'c');
        expect(exists).toBe(false);
        expect(next).toEqual(['a', 'b', 'c']);
    });

    it('removes item when present', () => {
        const { exists, next } = computeNextToggledIds(['a', 'b', 'c'], 'b');
        expect(exists).toBe(true);
        expect(next).toEqual(['a', 'c']);
    });
});

describe('isVideosByIdsQueryForIds', () => {
    it('matches videosByIds query key with same ids', () => {
        expect(isVideosByIdsQueryForIds(['videosByIds', ['a', 'b']], ['a', 'b'])).toBe(true);
    });

    it('returns false for different ids or non videosByIds keys', () => {
        expect(isVideosByIdsQueryForIds(['videosByIds', ['a', 'c']], ['a', 'b'])).toBe(false);
        expect(isVideosByIdsQueryForIds(['favourites', ['a', 'b']], ['a', 'b'])).toBe(false);
    });
});

describe('createIdsOnlyToggleMutationLifecycle', () => {
    it('optimistically updates and rolls back ids cache', async () => {
        const queryClient = new QueryClient();
        const queryKey = ['completedVideoIds', 'user-1'];
        queryClient.setQueryData(queryKey, ['a']);

        const lifecycle = createIdsOnlyToggleMutationLifecycle<{ videoId: string; isComplete: boolean }>({
            queryClient,
            primaryKey: queryKey,
            getNextIds: (previous, vars) => vars.isComplete
                ? previous.filter((id) => id !== vars.videoId)
                : Array.from(new Set([...previous, vars.videoId])),
        });

        const context = await lifecycle.onMutate({ videoId: 'b', isComplete: false });
        expect(queryClient.getQueryData<string[]>(queryKey)).toEqual(['a', 'b']);

        lifecycle.onError(new Error('test'), { videoId: 'b', isComplete: false }, context);
        expect(queryClient.getQueryData<string[]>(queryKey)).toEqual(['a']);
    });
});
