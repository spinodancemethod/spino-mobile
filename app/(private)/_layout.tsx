import React, { useEffect } from 'react';
import AppContent from './AppContent';
import { useAuth } from 'lib/auth';
import { ActivityIndicator } from 'react-native';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import { router } from 'expo-router';

const RootLayout = () => {
    const { user, loading } = useAuth();

    useEffect(() => {
        // Redirect to login after render if not loading and no user.
        // Moving router calls into an effect avoids "setState in render" errors.
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading]);

    if (loading) {
        return (
            <ThemedView padded safe>
                <ThemedText variant="title">Loading</ThemedText>
                <ActivityIndicator style={{ marginTop: 12 }} />
            </ThemedView>
        );
    }

    // explicit fallback: if not loading and no user, we've already scheduled
    // a redirect in the effect above — render nothing until navigation occurs.
    if (!user) {
        return null;
    }

    return <AppContent />;
};

export default RootLayout;