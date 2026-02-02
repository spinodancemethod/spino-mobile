import { StyleSheet, View } from 'react-native'
import React, { useMemo } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from 'constants/useTheme'
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'lib/queryClient';

/*
    Root layout for the app.

    Responsibilities:
    - Provide the QueryClientProvider so React Query is available app-wide.
    - Provide a theming context (ThemeProvider) wrapper so `useTheme` can read the app theme.
    - Define Stack routes for the main app shell. The `(dashboard)` group is mounted as a nested
        navigator; we keep the app-level Stack small and focused on routing.

    Notes:
    - Keep visual theming (colors/backgrounds) out of the Query client. The `useTheme` hook reads
        from a ThemeProvider when available, otherwise it falls back to system color scheme.
*/
import { ThemeProvider } from 'constants/ThemeProvider';

const RootLayout = () => {

    const { colors } = useTheme();

    // Memoize screen options 
    const screenOptions = useMemo(
        () => ({
            headerStyle: {
                backgroundColor: colors.navBackground,
            },
            headerTintColor: colors.title,
            contentStyle: {
                backgroundColor: colors.background,
            },
        }),
        [colors]
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <View style={{ flex: 1 }}>
                    <StatusBar />
                    <Stack screenOptions={screenOptions}>
                        <Stack.Screen name="index" options={{ title: "Home" }} />
                        <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
                        <Stack.Screen
                            name="(positions)/Positions"
                            options={{ title: 'Positions' }}
                        />

                    </Stack>
                </View>
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default RootLayout

const styles = StyleSheet.create({})