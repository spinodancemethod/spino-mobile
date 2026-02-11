import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from 'constants/useTheme';
import { useStyles } from 'constants/styles';
import Snackbar from 'Components/Snackbar';
import GlobalMenu from 'Components/GlobalMenu';

const AppContent: React.FC = () => {
    const { colors } = useTheme();
    const styles = useStyles();
    const segments = useSegments();
    // hide the global menu on the root/login page (index or empty segments)
    const showGlobalMenu = !(Number(segments.length) === 0 || segments[0] === '/');

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
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="home" options={{ headerShown: false }} />
                <Stack.Screen name="your-roadmap" options={{ title: 'Your Roadmap' }} />
                <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
            </Stack>
            <Snackbar />
            {showGlobalMenu && <GlobalMenu />}
        </View>
    );
};

export default AppContent;
