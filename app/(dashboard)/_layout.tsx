import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import { View, TouchableOpacity } from 'react-native'
import { useThemeContext } from 'constants/ThemeProvider'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
    const { mode, toggle } = useThemeContext();
    const insets = useSafeAreaInsets();

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
            </Tabs>
            <View style={{ position: 'absolute', top: insets.top + 8, right: insets.right + 12 }}>
                <TouchableOpacity onPress={toggle} style={{ padding: 8 }}>
                    <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={styles.icon.color} />
                </TouchableOpacity>
            </View>
        </>
    )
}