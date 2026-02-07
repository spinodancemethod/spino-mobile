import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import React from 'react'

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
                    name="favourites"
                    options={{
                        title: "Favourites", tabBarIcon: ({ focused }) => (
                            <Ionicons
                                size={24}
                                name={focused ? 'heart' : 'heart-outline'}
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