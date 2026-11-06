import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import {
    getRevenueCatOfferingsSnapshot,
    purchaseRevenueCatPackage,
    restoreRevenueCatPurchases,
} from 'lib/billing/revenuecat';
import { accountDetailsQueryKey } from './useAccountDetails';
import { entitlementQueryKey } from './useEntitlement';
import { subscriptionStatusQueryKey } from './useSubscriptionStatus';

export const revenueCatOfferingsQueryKey = ['revenueCatOfferings'] as const;

export function invalidateBillingQueries(queryClient: QueryClient, userId?: string | null) {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: entitlementQueryKey(userId) }),
    ]);
}

export function useRevenueCatOfferings() {
    return useQuery({
        queryKey: revenueCatOfferingsQueryKey,
        queryFn: getRevenueCatOfferingsSnapshot,
        staleTime: 1000 * 60,
    });
}

export function usePurchaseRevenueCatPackage(userId?: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (selectedPackage: PurchasesPackage) => purchaseRevenueCatPackage(selectedPackage),
        onSuccess: () => invalidateBillingQueries(queryClient, userId),
    });
}

export function useRestoreRevenueCatPurchases(userId?: string | null) {
    const queryClient = useQueryClient();
    return useMutation<CustomerInfo>({
        mutationFn: restoreRevenueCatPurchases,
        onSuccess: () => invalidateBillingQueries(queryClient, userId),
    });
}