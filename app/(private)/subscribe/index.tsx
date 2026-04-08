import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';
import { showSnack } from 'lib/snackbarService';
import { useAuth } from 'lib/auth';
import {
    getRevenueCatCurrentOffering,
    hasRevenueCatEntitlement,
    presentRevenueCatPaywall,
    purchaseRevenueCatPackage,
    getRevenueCatCustomerInfo,
} from 'lib/billing/revenuecat';
import { useSubscriptionStatus } from 'lib/hooks/useSubscriptionStatus';
import { subscriptionStatusQueryKey } from 'lib/hooks/useSubscriptionStatus';
import { accountDetailsQueryKey } from 'lib/hooks/useAccountDetails';
import { entitlementQueryKey } from 'lib/hooks/useEntitlement';
import { reportAppError } from 'lib/observability';

type Plan = {
    id: string;
    title: string;
    price: string;
    description: string;
    packageData: PurchasesPackage;
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
    monthly: 'Perfect if you want flexibility while building your roadmap habits.',
    annual: 'Best value for committed dancers focused on long-term progression.',
};

function getPlanId(packageData: PurchasesPackage) {
    switch (packageData.packageType) {
        case Purchases.PACKAGE_TYPE.MONTHLY:
            return 'monthly';
        case Purchases.PACKAGE_TYPE.ANNUAL:
            return 'annual';
        default:
            return packageData.identifier;
    }
}

function getPlanTitle(packageData: PurchasesPackage) {
    switch (packageData.packageType) {
        case Purchases.PACKAGE_TYPE.MONTHLY:
            return 'Monthly Plan';
        case Purchases.PACKAGE_TYPE.ANNUAL:
            return 'Yearly Plan';
        default:
            return packageData.product.title || 'Subscription Plan';
    }
}

function getPlanDescription(packageData: PurchasesPackage) {
    return PLAN_DESCRIPTIONS[getPlanId(packageData)] ?? 'Unlock your full roadmap workspace and personalized progression tools.';
}

export default function Subscribe() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const subscriptionStatus = useSubscriptionStatus();

    const offeringsQuery = useQuery({
        queryKey: ['revenuecatOffering', 'subscribe'],
        queryFn: getRevenueCatCurrentOffering,
        staleTime: 1000 * 60,
    });

    const plans = useMemo<Plan[]>(() => {
        const packages = offeringsQuery.data?.availablePackages ?? [];

        return packages.map((packageData) => ({
            id: getPlanId(packageData),
            title: getPlanTitle(packageData),
            price: packageData.product.priceString,
            description: getPlanDescription(packageData),
            packageData,
        }));
    }, [offeringsQuery.data]);

    useEffect(() => {
        if (!plans.length) {
            return;
        }

        setSelectedPlan((currentValue) => {
            if (currentValue && plans.some((plan) => plan.id === currentValue)) {
                return currentValue;
            }

            return plans[0].id;
        });
    }, [plans]);

    const purchaseMutation = useMutation({
        mutationFn: purchaseRevenueCatPackage,
    });

    const paywallMutation = useMutation({
        mutationFn: () => presentRevenueCatPaywall(offeringsQuery.data ?? null),
    });

    const selectedPlanData = useMemo(
        () => plans.find((plan) => plan.id === selectedPlan) ?? plans[0] ?? null,
        [selectedPlan]
    );

    const onCheckout = async () => {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
            showSnack('Subscriptions are available on iOS and Android only.');
            return;
        }

        if (!selectedPlanData) {
            showSnack('No subscription options are available right now.');
            return;
        }

        try {
            const customerInfo = await purchaseMutation.mutateAsync(selectedPlanData.packageData);

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: entitlementQueryKey(user?.id) }),
            ]);

            if (!hasRevenueCatEntitlement(customerInfo)) {
                showSnack('Purchase completed but access is not active yet. Please refresh in a few moments.');
                return;
            }

            showSnack('Subscription activated successfully.');
        } catch (error: any) {
            if (error?.userCancelled) {
                showSnack('Purchase cancelled.');
                return;
            }

            showSnack(error?.message ?? 'Failed to complete subscription purchase.');
            void reportAppError({
                context: 'billing.checkout',
                error,
                userId: user?.id,
                metadata: {
                    selectedPlan,
                    platform: Platform.OS,
                    offeringIdentifier: offeringsQuery.data?.identifier ?? null,
                    packageIdentifier: selectedPlanData.packageData.identifier,
                    step: 'purchase',
                },
            });
        }
    };

    const onOpenPaywall = async () => {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
            showSnack('Subscriptions are available on iOS and Android only.');
            return;
        }

        try {
            const result = await paywallMutation.mutateAsync();

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: entitlementQueryKey(user?.id) }),
            ]);

            if (result === 'PURCHASED' || result === 'RESTORED') {
                showSnack('Subscription access updated successfully.');
                return;
            }

            if (result === 'NOT_PRESENTED') {
                // RC skipped the paywall because it sees the entitlement as active.
                // Verify server-side so we show an accurate message.
                try {
                    const customerInfo = await getRevenueCatCustomerInfo();
                    if (hasRevenueCatEntitlement(customerInfo)) {
                        showSnack('Your Pro subscription is already active.');
                    }
                    // If no entitlement found despite NOT_PRESENTED (edge case), stay silent —
                    // the queries above were already invalidated so the UI will update.
                } catch {
                    // Silently ignore — queries already invalidated above.
                }
            }
        } catch (error: any) {
            showSnack(error?.message ?? 'Failed to open subscription options.');
            void reportAppError({
                context: 'billing.paywall',
                error,
                userId: user?.id,
                metadata: {
                    platform: Platform.OS,
                    offeringIdentifier: offeringsQuery.data?.identifier ?? null,
                },
            });
        }
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
            >
                <View style={[styles.hero, { backgroundColor: colors.primary }]}>
                    <ThemedText variant="title" style={{ ...styles.heroTitle, color: colors.onPrimary }}>
                        Upgrade Your Access
                    </ThemedText>
                    <ThemedText variant="subheader" style={{ ...styles.heroBody, color: colors.onPrimary }}>
                        Choose a subscription to unlock your full roadmap workspace and personalized progression tools.
                    </ThemedText>
                </View>

                <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="subheader" style={styles.statusTitle}>Current subscription status</ThemedText>
                    <ThemedText>
                        {subscriptionStatus.isLoading
                            ? 'Checking your access status...'
                            : subscriptionStatus.isActiveSubscription
                                ? 'Your subscription is active.'
                                : 'No active subscription found yet.'}
                    </ThemedText>
                    {subscriptionStatus.currentPeriodEnd ? (
                        <ThemedText variant="small" style={styles.statusHint}>
                            Access through {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}.
                        </ThemedText>
                    ) : null}
                </View>

                <ThemedText variant="subheader" style={styles.sectionLabel}>Choose your plan</ThemedText>
                {offeringsQuery.isLoading ? (
                    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText>Loading subscription options...</ThemedText>
                    </View>
                ) : null}
                {!offeringsQuery.isLoading && plans.length === 0 ? (
                    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText>No subscription options are available right now.</ThemedText>
                    </View>
                ) : null}
                {plans.map((plan) => {
                    const isSelected = plan.id === selectedPlan;
                    return (
                        <View
                            key={plan.id}
                            style={[
                                styles.planCard,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                },
                            ]}
                        >
                            <ThemedText variant="subheader" style={styles.planTitle}>{plan.title}</ThemedText>
                            <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
                            <ThemedText style={styles.planDescription}>{plan.description}</ThemedText>
                            <ThemedButton
                                title={isSelected ? 'Selected' : 'Choose Plan'}
                                onPress={() => setSelectedPlan(plan.id)}
                                style={styles.planButton}
                                disabled={isSelected}
                            />
                        </View>
                    );
                })}

                <View style={[styles.cartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="subheader" style={styles.cartTitle}>Cart Summary</ThemedText>
                    <View style={styles.cartRow}>
                        <ThemedText>{selectedPlanData?.title ?? 'Select a plan'}</ThemedText>
                        <ThemedText>{selectedPlanData?.price ?? '--'}</ThemedText>
                    </View>
                    <ThemedButton
                        title={purchaseMutation.isPending ? 'Processing Purchase...' : 'Subscribe'}
                        onPress={onCheckout}
                        style={{ width: '100%', marginTop: 12 }}
                        disabled={purchaseMutation.isPending || paywallMutation.isPending || offeringsQuery.isLoading || !selectedPlanData}
                    />
                    <ThemedButton
                        title={paywallMutation.isPending ? 'Opening subscription options...' : 'See subscription options'}
                        variant="ghost"
                        onPress={onOpenPaywall}
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={purchaseMutation.isPending || paywallMutation.isPending}
                    />
                    <ThemedText variant="small" style={styles.disclaimer}>
                        Purchases are processed securely through RevenueCat and your device's app store.
                    </ThemedText>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 28,
    },
    hero: {
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    heroTitle: {
        marginBottom: 8,
        fontWeight: '800',
        fontSize: 30,
        lineHeight: 38,
    },
    heroBody: {
        fontSize: 16,
        lineHeight: 24,
    },
    statusCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    statusTitle: {
        marginBottom: 6,
        fontWeight: '700',
    },
    statusHint: {
        marginTop: 6,
        opacity: 0.75,
    },
    sectionLabel: {
        marginBottom: 10,
        fontWeight: '700',
    },
    planCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    planTitle: {
        fontWeight: '700',
        marginBottom: 4,
    },
    planPrice: {
        fontWeight: '700',
        marginBottom: 6,
    },
    planDescription: {
        marginBottom: 10,
        lineHeight: 21,
    },
    planButton: {
        width: '100%',
    },
    cartCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
    },
    cartTitle: {
        marginBottom: 10,
        fontWeight: '700',
    },
    cartRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    disclaimer: {
        marginTop: 10,
        opacity: 0.75,
    },
});