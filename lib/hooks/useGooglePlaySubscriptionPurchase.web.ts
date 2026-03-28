// Web stub — react-native-iap is not available on web.
// Metro resolves this file instead of the native version when bundling for web.
import { useMutation } from '@tanstack/react-query';

export function useGooglePlaySubscriptionPurchase() {
    return useMutation({
        mutationFn: async () => {
            throw new Error('Google Play subscription purchases are not available on web.');
        },
    });
}
