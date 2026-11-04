import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/*
  Centralized React Query client.

  Default options:
  - staleTime: data shown from cache is refreshed in the background after a minute
  - gcTime: must be >= the persister maxAge so restored queries are not garbage collected on boot
  - retry: minimal retry on failure
  - refetchOnWindowFocus: disabled to avoid noisy network calls during dev

  The cache is persisted to AsyncStorage (see app/_layout.tsx) so a cold launch renders the
  previous session's roadmaps, categories and video references instantly while they refetch.
*/
export const PERSISTED_QUERY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            gcTime: PERSISTED_QUERY_MAX_AGE_MS,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

export const queryPersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'spino-query-cache',
    // Batch writes so rapid invalidations after a save don't thrash storage.
    throttleTime: 1000,
});

// Bump when the shape of persisted query data changes incompatibly.
export const QUERY_CACHE_BUSTER = 'v1';
