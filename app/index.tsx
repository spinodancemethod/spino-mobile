import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
// fonts are preloaded in app/_layout.tsx
import ThemedButton from 'Components/ThemedButton';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import { useAuth } from 'lib/auth';

export default function RootIndex() {
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        router.replace(user ? '/home' : '/login');
    }, [loading, user]);

    return (
        <ThemedView padded safe>
            <ThemedText variant="title">Welcome</ThemedText>
            <ThemedText variant="small">Checking authentication...</ThemedText>
            <ActivityIndicator style={{ marginTop: 20 }} />
        </ThemedView>
    );
}
