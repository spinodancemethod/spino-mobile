import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import React, { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native';
import ThemedText from 'Components/ThemedText';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { shouldRedirectForEntitlement } from 'lib/entitlementGuards';

function dashboardEntitlementQueryKey(userId?: string | null) {
    return ['dashboardEntitlement', userId ?? 'anonymous'];
}

async function fetchDashboardEntitlement(userId: string) {
    const { data, error } = await supabase.rpc('has_active_subscription', { p_user_id: userId });
    if (error) {
        throw error;
    }

    return Boolean(data);
}

/*
    Dashboard tab layout.

    Main responsibilities:
    - Render the bottom Tabs navigator for the main dashboard sections.
    - Provide a small development-only theme toggle button positioned inside the
        device safe area so it's always accessible across tabs.

    Implementation notes:
    - The toggle is a floating button (absolutely positioned) rather than a header button
        so it appears consistently regardless of which tab is active.
    - Tab icons use `useStyles()` theme tokens so their colors follow the active/inactive state.
*/

export default function DashboardLayout() {
    const styles = useStyles();
    const { user, loading: authLoading } = useAuth();

    const entitlement = useQuery({
        queryKey: dashboardEntitlementQueryKey(user?.id),
        queryFn: () => fetchDashboardEntitlement(user!.id),
        enabled: Boolean(user?.id),
        staleTime: 1000 * 20,
    });

    useEffect(() => {
        if (shouldRedirectForEntitlement({ isLoading: authLoading || entitlement.isLoading, hasAccess: Boolean(entitlement.data) })) {
            router.replace('/subscribe');
        }
    }, [authLoading, entitlement.isLoading, entitlement.data]);

    if (authLoading || entitlement.isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: styles.container.backgroundColor }}>
                <ActivityIndicator />
                <ThemedText style={{ marginTop: 10 }}>Checking subscription access...</ThemedText>
            </View>
        );
    }

    if (!entitlement.data) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: styles.container.backgroundColor }}>
                <ThemedText>Redirecting to subscription...</ThemedText>
            </View>
        );
    }


    return (
        <>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { paddingTop: 10, height: 105, backgroundColor: styles.card.backgroundColor },
                    tabBarActiveTintColor: styles.icon.color,
                    tabBarInactiveTintColor: styles.inactiveIcon.color,
                }}
            >
                {/* home moved into the burger menu */}
                <Tabs.Screen
                    name="inprogress"
                    options={{
                        title: "On Deck", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'star' : 'star-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
                <Tabs.Screen
                    name="your-roadmap"
                    options={{
                        title: "Your Roadmap", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'map' : 'map-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
                <Tabs.Screen
                    name="library"
                    options={{
                        title: "Library", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'library' : 'library-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
                <Tabs.Screen
                    name="positions"
                    options={{
                        title: "Positions", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'accessibility' : 'accessibility-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
            </Tabs>
        </>
    )
}