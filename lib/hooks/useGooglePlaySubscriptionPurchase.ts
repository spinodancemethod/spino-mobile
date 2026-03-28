import { useMutation } from '@tanstack/react-query';
import { Platform } from 'react-native';
import {
    fetchProducts,
    finishTransaction,
    initConnection,
    requestPurchase,
    type ProductSubscription,
    type Purchase,
} from 'react-native-iap';

type GooglePlaySubscriptionPurchaseInput = {
    productId: string;
    obfuscatedAccountId?: string;
};

type GooglePlaySubscriptionPurchaseResult = {
    purchaseToken: string;
    productId: string;
    basePlanId: string | null;
    purchase: Purchase;
};

function findSubscriptionById(items: Array<any>, productId: string): ProductSubscription | null {
    const match = items.find((item) => item?.id === productId && item?.type === 'subs');
    return (match as ProductSubscription) ?? null;
}

function normalizePurchase(result: Purchase | Purchase[] | null): Purchase | null {
    if (!result) {
        return null;
    }

    if (Array.isArray(result)) {
        return result[0] ?? null;
    }

    return result;
}

async function purchaseGooglePlaySubscription(
    input: GooglePlaySubscriptionPurchaseInput,
): Promise<GooglePlaySubscriptionPurchaseResult> {
    if (Platform.OS !== 'android') {
        throw new Error('Google Play subscription purchases are available on Android only.');
    }

    await initConnection();

    const products = await fetchProducts({ skus: [input.productId], type: 'subs' });
    const subscription = findSubscriptionById(products as Array<any>, input.productId);

    if (!subscription) {
        throw new Error('Subscription product is not available in Google Play.');
    }

    const primaryOfferToken = subscription.subscriptionOffers?.[0]?.offerTokenAndroid ?? null;

    const purchaseResponse = await requestPurchase({
        type: 'subs',
        request: {
            google: {
                skus: [input.productId],
                obfuscatedAccountId: input.obfuscatedAccountId,
                subscriptionOffers: primaryOfferToken
                    ? [{ sku: input.productId, offerToken: primaryOfferToken }]
                    : undefined,
            },
        },
    });

    const purchase = normalizePurchase(purchaseResponse);
    if (!purchase?.purchaseToken) {
        throw new Error('No purchase token was returned by Google Play.');
    }

    return {
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId ?? input.productId,
        basePlanId: purchase.currentPlanId ?? null,
        purchase,
    };
}

export function useGooglePlaySubscriptionPurchase() {
    return useMutation({
        mutationFn: purchaseGooglePlaySubscription,
    });
}

export async function finalizeGooglePlaySubscriptionPurchase(purchase: Purchase) {
    // Finalize only after backend verification succeeds.
    await finishTransaction({ purchase, isConsumable: false });
}
