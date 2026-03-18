import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';
import { useSubscriptionStatus } from 'lib/hooks/useSubscriptionStatus';

const REDIRECT_DELAY_MS = 5000;

export default function SubscribeSuccess() {
    const { colors } = useTheme();
    const subscriptionStatus = useSubscriptionStatus({ pollAfterReturn: true });

    useEffect(() => {
        if (subscriptionStatus.isActiveSubscription) {
            const timeout = setTimeout(() => {
                router.replace('/home');
            }, REDIRECT_DELAY_MS);

            return () => clearTimeout(timeout);
        }

        return undefined;
    }, [subscriptionStatus.isActiveSubscription]);

    return (
        <ThemedView safe padded style={styles.container}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText variant="title" style={styles.title}>Payment received</ThemedText>
                <ThemedText style={styles.body}>
                    Stripe returned to the app successfully. We are refreshing your subscription status now.
                </ThemedText>

                {subscriptionStatus.isActiveSubscription ? (
                    <ThemedText style={styles.successText}>
                        Your access is active. Redirecting you to Home in 5 seconds...
                    </ThemedText>
                ) : (
                    <View style={styles.processingRow}>
                        <ActivityIndicator />
                        <ThemedText style={styles.processingText}>Waiting for Stripe webhook confirmation...</ThemedText>
                    </View>
                )}

                {subscriptionStatus.error ? (
                    <ThemedText variant="small" style={styles.errorText}>
                        We could not confirm your subscription yet. If payment succeeded, try refresh below in a few seconds.
                    </ThemedText>
                ) : null}

                <ThemedButton title="Refresh status" onPress={subscriptionStatus.refetch} style={styles.button} />
                <ThemedButton title="Back to subscription" variant="ghost" onPress={() => router.replace('/subscribe')} style={styles.button} />
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
    },
    card: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 20,
        gap: 12,
    },
    title: {
        fontWeight: '800',
    },
    body: {
        lineHeight: 22,
    },
    successText: {
        fontWeight: '700',
    },
    processingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    processingText: {
        flex: 1,
    },
    errorText: {
        opacity: 0.8,
    },
    button: {
        width: '100%',
    },
});