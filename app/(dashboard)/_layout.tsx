import { Tabs, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useStyles } from "constants/styles";
import { View, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native'
import ThemedText from 'Components/ThemedText'
import { useThemeContext } from 'constants/ThemeProvider'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState } from 'react'

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
    const [menuOpen, setMenuOpen] = useState(false);
    const router = useRouter();

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
            </Tabs>
            <View style={{ position: 'absolute', top: insets.top + 8, right: insets.right + 12 }}>
                <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ padding: 8 }}>
                    <Ionicons name={'menu'} size={24} color={styles.icon.color} />
                </TouchableOpacity>
            </View>

            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
                </TouchableWithoutFeedback>
                <View style={{ position: 'absolute', top: insets.top + 56, right: 12, width: 220, backgroundColor: styles.card.backgroundColor, borderRadius: 12, padding: 8, elevation: 6 }}>
                    <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'home-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <ThemedText variant="subheader">Home</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { toggle(); setMenuOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <View>
                            <View style={{}}>
                                <View style={{}}>
                                    <View>
                                        <Ionicons />
                                    </View>
                                </View>
                            </View>
                            <View>
                                <View />
                            </View>
                        </View>
                        <View style={{ position: 'absolute', left: 36 }}>
                            <View />
                        </View>
                        <View style={{ position: 'absolute', right: 12 }} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('profile'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name={'person-circle-outline'} size={18} color={styles.icon.color} />
                        <View style={{ width: 12 }} />
                        <View>
                            <View style={{}}>
                                <View>
                                    <View style={{}}>
                                        <View />
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View style={{ position: 'absolute', right: 12 }}>
                            <View />
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>
        </>
    )
}