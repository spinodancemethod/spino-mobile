import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { getAvailablePurchases, initConnection } from 'react-native-iap';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';
import { accountDetailsQueryKey } from 'lib/hooks/useAccountDetails';
import { subscriptionStatusQueryKey } from 'lib/hooks/useSubscriptionStatus';

type RestoreGooglePlayPurchasesResult = {
    restoredCount: number;
};

async function restoreGooglePlayPurchases(): Promise<RestoreGooglePlayPurchasesResult> {
    if (Platform.OS !== 'android') {
        return { restoredCount: 0 };
    }

    await initConnection();
    const purchases = await getAvailablePurchases();

    let restoredCount = 0;
    for (const purchase of purchases) {
        if (!purchase?.purchaseToken) {
            continue;
        }

        const { data, error } = await supabase.functions.invoke('verify-google-play-purchase', {
            body: {
                packageName: process.env.EXPO_PUBLIC_GOOGLE_PLAY_ANDROID_PACKAGE_NAME,
                purchaseToken: purchase.purchaseToken,
                productId: purchase.productId,
                basePlanId: purchase.currentPlanId,
            },
        });

        if (error) {
            throw error;
        }

        if ((data as any)?.ok) {
            restoredCount += 1;
        }
    }

    return { restoredCount };
}

export function useRestoreGooglePlayPurchases() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreGooglePlayPurchases,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(user?.id) }),
            ]);
        },
    });
}
