import React, { useEffect } from 'react';
import AppContent from './AppContent';
import { useAuth } from 'lib/auth';
import { ActivityIndicator } from 'react-native';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';

const RootLayout = () => {
    const { user, loading } = useAuth();

    useEffect(() => {
        // if not loading and no user, the global auth listener already routes to /login
        // we keep this effect in case you want to extend behavior here
    }, [user, loading]);

    if (loading) {
        return (
            <ThemedView padded safe>
                <ThemedText variant="title">Loading</ThemedText>
                <ActivityIndicator style={{ marginTop: 12 }} />
            </ThemedView>
        );
    }

    // if user is null, the AuthProvider's onAuthStateChange will handle routing to /login
    if (!user) return null;

    return <AppContent />;
};

export default RootLayout;