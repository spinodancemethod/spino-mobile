export type VerifyGooglePlayPurchaseResult = {
    ok: boolean;
    status: string;
    currentPeriodEnd: string | null;
    hasAccess: boolean;
    productId: string | null;
    basePlanId: string | null;
    orderId: string | null;
};

export function normalizeVerifyGooglePlayResponse(data: any): VerifyGooglePlayPurchaseResult {
    if (!data?.ok) {
        throw new Error(data?.error ?? 'Google Play verification failed');
    }

    return {
        ok: Boolean(data?.ok),
        status: data?.status ?? 'expired',
        currentPeriodEnd: data?.currentPeriodEnd ?? null,
        hasAccess: Boolean(data?.hasAccess),
        productId: data?.productId ?? null,
        basePlanId: data?.basePlanId ?? null,
        orderId: data?.orderId ?? null,
    };
}

export async function extractInvokeErrorMessage(error: any) {
    let message = error?.message ?? 'Unknown error';
    try {
        const body = await error?.context?.json?.();
        if (typeof body?.error === 'string') {
            message = body.error;
        }
    } catch {
        // Keep fallback message when response parsing fails.
    }

    return message;
}
