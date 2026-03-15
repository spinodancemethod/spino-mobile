import React, { useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';
import { showSnack } from 'lib/snackbarService';
import { useCreateCheckoutSession } from 'lib/hooks/useCreateCheckoutSession';
import { useSubscriptionStatus } from 'lib/hooks/useSubscriptionStatus';

type Plan = {
    id: 'monthly' | 'yearly';
    title: string;
    price: string;
    description: string;
};

const plans: Plan[] = [
    {
        id: 'monthly',
        title: 'Monthly Plan',
        price: '$19 / month',
        description: 'Perfect if you want flexibility while building your roadmap habits.',
    },
    {
        id: 'yearly',
        title: 'Yearly Plan',
        price: '$149 / year',
        description: 'Best value for committed dancers focused on long-term progression.',
    },
];

export default function Subscribe() {
    const { colors } = useTheme();
    const [selectedPlan, setSelectedPlan] = useState<Plan['id']>('monthly');
    const checkoutMutation = useCreateCheckoutSession();
    const subscriptionStatus = useSubscriptionStatus();

    const selectedPlanData = useMemo(
        () => plans.find((plan) => plan.id === selectedPlan) ?? plans[0],
        [selectedPlan]
    );

    const onCheckout = async () => {
        const priceId =
            selectedPlan === 'monthly'
                ? process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_MONTHLY
                : process.env.EXPO_PUBLIC_STRIPE_PRICE_ID_YEARLY;

        if (!priceId) {
            showSnack('Missing Stripe price ID configuration for this plan.');
            return;
        }

        try {
            const result = await checkoutMutation.mutateAsync({ priceId });
            await Linking.openURL(result.url);
        } catch (error: any) {
            showSnack(error?.message ?? 'Failed to start checkout.');
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
                        <ThemedText>{selectedPlanData.title}</ThemedText>
                        <ThemedText>{selectedPlanData.price}</ThemedText>
                    </View>
                    <ThemedButton
                        title={checkoutMutation.isPending ? 'Starting Checkout...' : 'Continue to Checkout'}
                        onPress={onCheckout}
                        style={{ width: '100%', marginTop: 12 }}
                        disabled={checkoutMutation.isPending}
                    />
                    <ThemedText variant="small" style={styles.disclaimer}>
                        Secure checkout is powered by Stripe via Supabase Edge Functions.
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