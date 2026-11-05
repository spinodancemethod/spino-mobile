import { Tabs, router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import { useSubscriptionStatus } from "lib/hooks/useSubscriptionStatus";
import { requestOpenDefaultRoadmap } from "lib/defaultRoadmapIntent";
import { showSnack } from "lib/snackbarService";
import React from 'react'

/*
    Dashboard tab layout.

    Main responsibilities:
    - Render the bottom Tabs navigator for the main dashboard sections:
      Home (landing page after login), Your Roadmaps, Add Video.
    - Gate the Your Roadmaps and Add Video tabs behind the subscription: for free
      users they are rendered dimmed/"blurred" and tapping them does not navigate.
      Instead a snackbar explains and the user is sent to the subscribe screen.

    Implementation notes:
    - Tab icons use `useStyles()` theme tokens so their colors follow the active/inactive state.
    - The gate is a tabPress listener with `preventDefault()`, which keeps the tab visible
      (so users can see what they unlock) without rendering the underlying screen.
    - While the entitlement check is still loading we leave the tabs enabled so a slow
      RPC never locks out a paying user; the screens themselves are RLS-protected anyway.
*/

// Expo Router 58 removed the `initialRouteName` navigator prop. `anchor` in
// unstable_settings preserves the previous behavior: "home" is the landing tab
// and is inserted as the back destination when deep linking into another tab.
export const unstable_settings = {
    anchor: 'home',
};

// Opacity applied to the locked tabs for free users.
const LOCKED_TAB_OPACITY = 0.3;

export default function DashboardLayout() {
    const styles = useStyles();
    // Same source of truth as the Home tab's "Your workspace is ready" card (direct read of the
    // subscriptions row), so the tabs can never disagree with what Home shows. The entitlement
    // RPC query is kept for the cache guard in app/_layout.tsx only.
    const { isActiveSubscription, isLoading, isError } = useSubscriptionStatus();
    // Only lock once we know for sure the user is on the free tier. A failed fetch (network,
    // expired token mid-refresh) never locks the tabs; RLS still protects the data.
    const locked = !isLoading && !isError && !isActiveSubscription;

    // Shared options for the two subscription-gated tabs.
    const gatedOptions = {
        tabBarItemStyle: locked ? { opacity: LOCKED_TAB_OPACITY } : undefined,
        tabBarAccessibilityLabel: locked ? 'Locked, subscription required' : undefined,
    };
    const gatedListeners = {
        tabPress: (e: { preventDefault: () => void }) => {
            if (!locked) return;
            e.preventDefault();
            showSnack('Subscribe to unlock this feature.');
            router.push('/subscribe');
        },
    };

    return (
        <>
            <Tabs
                // Required for the "home" anchor above to take effect:
                // non-stack navigators only return to the anchor when backBehavior
                // is "initialRoute" (the default is "firstRoute").
                backBehavior="initialRoute"
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { paddingTop: 10, height: 105, backgroundColor: styles.card.backgroundColor },
                    tabBarActiveTintColor: styles.icon.color,
                    tabBarInactiveTintColor: styles.inactiveIcon.color,
                }}
            >
                <Tabs.Screen
                    name="home"
                    options={{
                        title: "Home", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'home' : 'home-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
                <Tabs.Screen
                    name="your-roadmaps"
                    listeners={{
                        tabPress: (e) => {
                            gatedListeners.tabPress(e);
                            if (locked) return;
                            // The list screen opens the starred roadmap (if any) on focus, so Back
                            // still lands on the roadmap list. See lib/defaultRoadmapIntent.ts.
                            requestOpenDefaultRoadmap();
                        },
                    }}
                    options={{
                        ...gatedOptions,
                        title: "Your Roadmaps", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={locked ? 'lock-closed-outline' : focused ? 'map' : 'map-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
                <Tabs.Screen
                    name="add-video"
                    listeners={gatedListeners}
                    options={{
                        ...gatedOptions,
                        title: "Add Video", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={locked ? 'lock-closed-outline' : focused ? 'add-circle' : 'add-circle-outline'}
                                color={focused ? styles.icon.color : styles.inactiveIcon.color}
                            />
                        )
                    }}
                />
            </Tabs>
        </>
    )
}
