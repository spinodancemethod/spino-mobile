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

const RESTORE_VERIFY_DELAY_MS = 6500;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function restoreGooglePlayPurchases(): Promise<RestoreGooglePlayPurchasesResult> {
    if (Platform.OS !== 'android') {
        return { restoredCount: 0 };
    }

    await initConnection();
    const purchases = await getAvailablePurchases();

    let restoredCount = 0;
    for (let index = 0; index < purchases.length; index += 1) {
        const purchase = purchases[index];
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

        // The verify edge function allows 10 requests/minute per user.
        // This small delay avoids 429 errors during restore loops.
        if (index < purchases.length - 1) {
            await sleep(RESTORE_VERIFY_DELAY_MS);
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
