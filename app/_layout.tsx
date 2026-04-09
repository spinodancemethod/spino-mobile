import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ErrorBoundary from 'Components/ErrorBoundary';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from 'lib/queryClient';
import { ThemeProvider } from 'constants/ThemeProvider';
import { AuthProvider, useAuth } from 'lib/auth';
import {
    addRevenueCatCustomerInfoUpdateListener,
    getRevenueCatCustomerInfo,
    initializeRevenueCat,
} from 'lib/billing/revenuecat';
import Snackbar from 'Components/Snackbar';
import { showSnack } from 'lib/snackbarService';
import { accountDetailsQueryKey } from 'lib/hooks/useAccountDetails';
import { entitlementQueryKey } from 'lib/hooks/useEntitlement';
import { subscriptionStatusQueryKey } from 'lib/hooks/useSubscriptionStatus';
import { useEntitlement } from 'lib/hooks/useEntitlement';

function validateStartupEnv() {
    // Supabase backend for user auth and entitlements
    const supabaseVars = {
        EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };

    // RevenueCat SDKs for iOS and Android in-app purchases (both keys needed for cross-platform support)
    const revenuecat = {
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    };

    const critical = { ...supabaseVars, ...revenuecat };

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

function RevenueCatBootstrap() {
    const { user, loading } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (loading) {
            return;
        }

        void initializeRevenueCat(user?.id ?? null);
    }, [loading, user?.id]);

    useEffect(() => {
        if (loading || !user?.id) {
            return;
        }

        const userId = user.id;
        let isMounted = true;
        let unsubscribeCustomerInfoListener: (() => void) | null = null;

        async function bootstrapCustomerInfoSync() {
            try {
                // Pull latest customer info once and then keep React Query state hot via listener callbacks.
                await getRevenueCatCustomerInfo();
                if (!isMounted) {
                    return;
                }

                unsubscribeCustomerInfoListener = await addRevenueCatCustomerInfoUpdateListener(() => {
                    void Promise.all([
                        queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(userId) }),
                        queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(userId) }),
                        queryClient.invalidateQueries({ queryKey: entitlementQueryKey(userId) }),
                    ]);
                });
            } catch {
                // Ignore sync bootstrap errors; manual refresh paths still work.
            }
        }

        void bootstrapCustomerInfoSync();

        return () => {
            isMounted = false;
            unsubscribeCustomerInfoListener?.();
        };
    }, [loading, queryClient, user?.id]);

    return null;
}

function EntitlementCacheGuard() {
    const { user, loading } = useAuth();
    const { isSubscribed, isLoading: entitlementLoading } = useEntitlement();
    const queryClient = useQueryClient();
    const previousSubscriptionRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (loading || entitlementLoading || !user?.id) {
            return;
        }

        const previous = previousSubscriptionRef.current;

        // On paid -> free transitions, drop cached paid payloads immediately
        // and refetch user-visible collections under current RLS.
        if (previous === true && isSubscribed === false) {
            queryClient.removeQueries({ queryKey: ['video'] });
            queryClient.removeQueries({ queryKey: ['videos'] });
            queryClient.removeQueries({ queryKey: ['videosByIds'] });

            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['favourites', user.id] }),
                queryClient.invalidateQueries({ queryKey: ['deck', user.id] }),
                queryClient.invalidateQueries({ queryKey: ['positions'] }),
            ]);
        }

        previousSubscriptionRef.current = isSubscribed;
    }, [entitlementLoading, isSubscribed, loading, queryClient, user?.id]);

    useEffect(() => {
        if (!user?.id) {
            previousSubscriptionRef.current = null;
        }
    }, [user?.id]);

    return null;
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
                        <RevenueCatBootstrap />
                        <EntitlementCacheGuard />
                        <Slot />
                        <Snackbar />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
