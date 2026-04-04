import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ErrorBoundary from 'Components/ErrorBoundary';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'lib/queryClient';
import { ThemeProvider } from 'constants/ThemeProvider';
import { AuthProvider } from 'lib/auth';
import Snackbar from 'Components/Snackbar';
import { showSnack } from 'lib/snackbarService';

function validateStartupEnv() {
    const critical = {
        EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };

    const warnings = Object.entries(critical)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (warnings.length > 0) {
        const msg = `Missing critical env vars: ${warnings.join(', ')}`;
        // eslint-disable-next-line no-console
        console.warn('[startup] ' + msg);
        showSnack(msg);
    }
}

export default function RootLayout() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                // preload icon fonts used across the app
                await Font.loadAsync(Ionicons.font as any);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[fonts] preload failed', e);
            } finally {
                if (mounted) {
                    // validate startup environment
                    validateStartupEnv();
                    setReady(true);
                }
            }
        }

        load();
        return () => { mounted = false; };
    }, []);

    if (!ready) {
        return (
            <ThemedView padded safe>
                <ThemedText variant="title">Starting app</ThemedText>
                <ThemedText variant="small">Loading resources...</ThemedText>
                <ActivityIndicator style={{ marginTop: 16 }} />
            </ThemedView>
        );
    }

    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <Slot />
                        <Snackbar />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
