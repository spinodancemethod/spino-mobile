import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'lib/queryClient';
import { ThemeProvider } from 'constants/ThemeProvider';

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
                if (mounted) setReady(true);
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
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <Slot />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
