import { useMutation } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';

type VerifyGooglePlayPurchaseInput = {
    purchaseToken: string;
    productId?: string;
    basePlanId?: string;
    packageName?: string;
};

type VerifyGooglePlayPurchaseResult = {
    ok: boolean;
    status: string;
    currentPeriodEnd: string | null;
    hasAccess: boolean;
    productId: string | null;
    basePlanId: string | null;
    orderId: string | null;
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
        let message = error.message;
        try {
            const body = await (error as any).context?.json?.();
            if (typeof body?.error === 'string') {
                message = body.error;
            }
        } catch {
            // Keep the default message if response parsing fails.
        }

        throw new Error(message);
    }

    if (!(data as any)?.ok) {
        throw new Error((data as any)?.error ?? 'Google Play verification failed');
    }

    return {
        ok: Boolean((data as any)?.ok),
        status: (data as any)?.status ?? 'expired',
        currentPeriodEnd: (data as any)?.currentPeriodEnd ?? null,
        hasAccess: Boolean((data as any)?.hasAccess),
        productId: (data as any)?.productId ?? null,
        basePlanId: (data as any)?.basePlanId ?? null,
        orderId: (data as any)?.orderId ?? null,
    };
}

export function useVerifyGooglePlayPurchase() {
    return useMutation({
        mutationFn: verifyGooglePlayPurchase,
    });
}
