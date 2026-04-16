import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import React from 'react'
import { ActivityIndicator, View } from 'react-native';
import ThemedText from 'Components/ThemedText';
import { useEntitlement } from 'lib/hooks/useEntitlement';

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
    - Free-tier users are admitted into the dashboard. The subscribe screen is reached
        only via explicit upsell CTAs within the content screens.
*/

export default function DashboardLayout() {
    const styles = useStyles();
    const { isLoading } = useEntitlement();

    // Show a brief loading state while the entitlement check resolves.
    // Free and paid users both proceed past this point — no redirect.
    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: styles.container.backgroundColor }}>
                <ActivityIndicator />
                <ThemedText style={{ marginTop: 10 }}>Loading...</ThemedText>
            </View>
        );
    }

    return (
        <>
            <Tabs
                initialRouteName="your-roadmap"
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { paddingTop: 10, height: 105, backgroundColor: styles.card.backgroundColor },
                    tabBarActiveTintColor: styles.icon.color,
                    tabBarInactiveTintColor: styles.inactiveIcon.color,
                }}
            >
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