import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import { useTheme } from 'constants/useTheme';

const REDIRECT_DELAY_MS = 5000;

export default function SubscribeCancel() {
    const { colors } = useTheme();

    useEffect(() => {
        const timeout = setTimeout(() => {
            router.replace('/subscribe');
        }, REDIRECT_DELAY_MS);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <ThemedView safe padded style={styles.container}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText variant="title" style={styles.title}>Checkout canceled</ThemedText>
                <ThemedText style={styles.body}>
                    No payment was completed. You can return to the subscription page and try again whenever you are ready.
                </ThemedText>
                <ThemedText style={styles.redirectText}>
                    Returning to the subscription page in 5 seconds...
                </ThemedText>
                <ThemedButton title="Back to subscription" onPress={() => router.replace('/subscribe')} style={styles.button} />
                <ThemedButton title="Go Home" variant="ghost" onPress={() => router.replace('/home')} style={styles.button} />
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
    redirectText: {
        opacity: 0.8,
    },
    button: {
        width: '100%',
    },
});