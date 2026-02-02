import { QueryClient } from '@tanstack/react-query';

/*
  Centralized React Query client.

  Default options:
  - staleTime: keeps queries fresh for a short period to reduce refetching
  - retry: minimal retry on failure
  - refetchOnWindowFocus: disabled to avoid noisy network calls during dev
*/
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
