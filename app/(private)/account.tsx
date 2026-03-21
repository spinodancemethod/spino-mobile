import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';
import { useAccountDetails } from 'lib/hooks/useAccountDetails';
import { useCancelSubscription } from 'lib/hooks/useCancelSubscription';

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
    const cancelSubscription = useCancelSubscription();
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

    // Derived from query data — kept above early returns so hook call order is stable.
    const account = accountQuery.data ?? null;
    const canCancelSubscription = useMemo(
        () => Boolean(account?.hasActiveSubscription && !account?.cancelAtPeriodEnd),
        [account?.cancelAtPeriodEnd, account?.hasActiveSubscription],
    );

    async function handleConfirmCancelSubscription() {
        try {
            await cancelSubscription.mutateAsync();
            setConfirmCancelOpen(false);
        } catch {
            // Keep modal open and render the server error so user can retry.
        }
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

                    {canCancelSubscription ? (
                        <ThemedButton
                            title="Cancel subscription"
                            variant="warning"
                            onPress={() => setConfirmCancelOpen(true)}
                            style={{ width: '100%', marginTop: 8 }}
                        />
                    ) : null}

                    {account.cancelAtPeriodEnd ? (
                        <ThemedText variant="small" style={styles.scheduledText}>
                            Cancellation is already scheduled for the end of your current billing period.
                        </ThemedText>
                    ) : null}
                </View>

                <ThemedButton title="Manage subscription" onPress={() => router.push('/subscribe')} style={{ width: '100%' }} />
            </ScrollView>

            <Modal
                visible={confirmCancelOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmCancelOpen(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setConfirmCancelOpen(false)}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader" style={styles.modalTitle}>Confirm cancellation</ThemedText>
                        <ThemedText style={styles.modalBody}>
                            Your subscription will be canceled at the end of the current billing period.
                        </ThemedText>

                        {cancelSubscription.error ? (
                            <ThemedText style={styles.modalError}>
                                {cancelSubscription.error instanceof Error
                                    ? cancelSubscription.error.message
                                    : 'Could not cancel subscription. Please try again.'}
                            </ThemedText>
                        ) : null}

                        <View style={styles.modalActions}>
                            <ThemedButton
                                title="Keep subscription"
                                variant="ghost"
                                onPress={() => setConfirmCancelOpen(false)}
                                style={styles.modalButton}
                            />
                            <ThemedButton
                                title="Confirm cancel"
                                variant="warning"
                                loading={cancelSubscription.isPending}
                                onPress={handleConfirmCancelSubscription}
                                style={styles.modalButton}
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
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
    scheduledText: {
        marginTop: 6,
        lineHeight: 20,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 18,
    },
    modalCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 8,
    },
    modalTitle: {
        fontWeight: '700',
    },
    modalBody: {
        lineHeight: 22,
    },
    modalError: {
        lineHeight: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    modalButton: {
        flex: 1,
    },
});
