import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";

export default function DashboardLayout() {
    const styles = useStyles();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { paddingTop: 10, height: 105, backgroundColor: styles.card.backgroundColor },
                tabBarActiveTintColor: styles.icon.color,
                tabBarInactiveTintColor: styles.inactiveIcon.color,
            }}
        >
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
                name="saved"
                options={{
                    title: "Saved", tabBarIcon: ({ focused }) => (
                        <Ionicons
                            size={24}
                            name={focused ? 'save' : 'save-outline'}
                            color={focused ? styles.icon.color : styles.inactiveIcon.color}
                        />
                    )
                }}
            />
        </Tabs>
    )
}