import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';
import { useAccountDetails } from 'lib/hooks/useAccountDetails';
import { useRestoreGooglePlayPurchases } from 'lib/hooks/useRestoreGooglePlayPurchases';
import { showSnack } from 'lib/snackbarService';

function formatDate(value: string | null) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleDateString();
}

function formatSubscriptionStatus(status: string | null) {
    if (!status) {
        return 'No active subscription';
    }

    return status.replaceAll('_', ' ');
}

export default function AccountPage() {
    const { colors } = useTheme();
    const accountQuery = useAccountDetails();
    const restorePurchases = useRestoreGooglePlayPurchases();

    const account = accountQuery.data ?? null;

    async function handleRestorePurchases() {
        try {
            const result = await restorePurchases.mutateAsync();
            if (result.restoredCount > 0) {
                showSnack(`Restored ${result.restoredCount} purchase(s).`);
            } else {
                showSnack('No active Google Play purchases were found to restore.');
            }
        } catch (error: any) {
            showSnack(error?.message ?? 'Failed to restore purchases.');
        }
    }

    function handleManageInGooglePlay() {
        if (Platform.OS !== 'android') {
            showSnack('Google Play subscription management is available on Android only.');
            return;
        }

        void Linking.openURL('https://play.google.com/store/account/subscriptions');
    }

    if (accountQuery.isLoading) {
        return (
            <ThemedView safe padded style={styles.centered}>
                <ThemedText variant="title">Loading account</ThemedText>
                <ActivityIndicator style={{ marginTop: 12 }} />
            </ThemedView>
        );
    }

    if (accountQuery.error || !account) {
        return (
            <ThemedView safe padded style={styles.centered}>
                <ThemedText variant="title">Could not load account details</ThemedText>
                <ThemedText style={styles.errorText}>
                    {accountQuery.error instanceof Error
                        ? accountQuery.error.message
                        : 'Please try again in a moment.'}
                </ThemedText>
                <ThemedButton title="Retry" onPress={() => accountQuery.refetch()} style={{ width: '100%', marginTop: 12 }} />
            </ThemedView>
        );
    }

    const subscriptionBadgeLabel = account.hasActiveSubscription ? 'Active subscription' : 'No active subscription';
    const subscriptionBadgeColor = account.hasActiveSubscription ? '#2e8b57' : colors.border;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.hero, { backgroundColor: colors.primary }]}>
                    <ThemedText variant="title" style={{ ...styles.heroTitle, color: colors.onPrimary }}>
                        Account
                    </ThemedText>
                    <ThemedText variant="subheader" style={{ ...styles.heroBody, color: colors.onPrimary }}>
                        Manage your account details and review your current subscription status.
                    </ThemedText>
                </View>

                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="subheader" style={styles.cardTitle}>Account details</ThemedText>
                    <View style={styles.row}>
                        <ThemedText variant="small">Email</ThemedText>
                        <ThemedText>{account.email ?? 'N/A'}</ThemedText>
                    </View>
                    <View style={styles.row}>
                        <ThemedText variant="small">Joined</ThemedText>
                        <ThemedText>{formatDate(account.createdAt)}</ThemedText>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="subheader" style={styles.cardTitle}>Subscription</ThemedText>
                    <View style={[styles.badge, { borderColor: subscriptionBadgeColor }]}>
                        <ThemedText style={styles.badgeText}>{subscriptionBadgeLabel}</ThemedText>
                    </View>

                    <View style={styles.row}>
                        <ThemedText variant="small">Status</ThemedText>
                        <ThemedText>{formatSubscriptionStatus(account.subscriptionStatus)}</ThemedText>
                    </View>
                    <View style={styles.row}>
                        <ThemedText variant="small">Current period ends</ThemedText>
                        <ThemedText>{formatDate(account.currentPeriodEnd)}</ThemedText>
                    </View>
                </View>

                <ThemedButton title="Manage subscription" onPress={() => router.push('/subscribe')} style={{ width: '100%' }} />
                <ThemedButton
                    title={restorePurchases.isPending ? 'Restoring purchases...' : 'Restore Google Play purchases'}
                    variant="ghost"
                    onPress={handleRestorePurchases}
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={restorePurchases.isPending}
                />
                <ThemedButton
                    title="Manage in Google Play"
                    variant="ghost"
                    onPress={handleManageInGooglePlay}
                    style={{ width: '100%', marginTop: 8 }}
                />

                {/* Legal and support links for Play Store compliance */}
                <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }}>
                    <ThemedButton
                        title="Privacy Policy"
                        variant="ghost"
                        onPress={() => Linking.openURL('https://example.com/privacy')}
                        style={{ width: '100%' }}
                    />
                    <ThemedButton
                        title="Terms of Service"
                        variant="ghost"
                        onPress={() => Linking.openURL('https://example.com/terms')}
                        style={{ width: '100%' }}
                    />
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 30,
    },
    centered: {
        justifyContent: 'center',
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
    },
    heroBody: {
        lineHeight: 22,
    },
    card: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        gap: 8,
    },
    cardTitle: {
        fontWeight: '700',
        marginBottom: 2,
    },
    row: {
        gap: 4,
    },
    badge: {
        borderWidth: 1,
        borderRadius: 999,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 6,
    },
    badgeText: {
        fontWeight: '700',
    },
    monoText: {
        fontFamily: 'Courier',
        fontSize: 12,
    },
    errorText: {
        marginTop: 10,
        lineHeight: 22,
    },
});
