// Web stub — react-native-iap is not available on web.
// Metro resolves this file instead of the native version when bundling for web.
import { useMutation } from '@tanstack/react-query';

export function useRestoreGooglePlayPurchases() {
    return useMutation({
        mutationFn: async () => ({ restoredCount: 0 }),
    });
}
