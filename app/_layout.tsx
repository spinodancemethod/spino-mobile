import { StyleSheet, View } from 'react-native'
import React, { useMemo } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from 'constants/useTheme'

const RootLayout = () => {

    const colors = useTheme(); // Manually Colouring Stack

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
        <View style={{ flex: 1 }}>
            <StatusBar />
            <Stack screenOptions={screenOptions}>
                <Stack.Screen name="index" options={{ title: "Home" }} />
                <Stack.Screen
                    name="(positions)/Positions"
                    options={{ title: 'Positions' }}
                />
            </Stack>

        </View>
    )
}

export default RootLayout

const styles = StyleSheet.create({})