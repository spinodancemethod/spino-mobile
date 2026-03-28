import { useMutation } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import {
    extractInvokeErrorMessage,
    normalizeVerifyGooglePlayResponse,
    type VerifyGooglePlayPurchaseResult,
} from 'lib/billing/verifyMapping';

type VerifyGooglePlayPurchaseInput = {
    purchaseToken: string;
    productId?: string;
    basePlanId?: string;
    packageName?: string;
};

async function verifyGooglePlayPurchase(
    input: VerifyGooglePlayPurchaseInput,
): Promise<VerifyGooglePlayPurchaseResult> {
    const packageName = input.packageName ?? process.env.EXPO_PUBLIC_GOOGLE_PLAY_ANDROID_PACKAGE_NAME;

    const { data, error } = await supabase.functions.invoke('verify-google-play-purchase', {
        body: {
            packageName,
            purchaseToken: input.purchaseToken,
            productId: input.productId,
            basePlanId: input.basePlanId,
        },
    });

    if (error) {
        const message = await extractInvokeErrorMessage(error);
        throw new Error(message);
    }

    return normalizeVerifyGooglePlayResponse(data);
}

export function useVerifyGooglePlayPurchase() {
    return useMutation({
        mutationFn: verifyGooglePlayPurchase,
    });
}
