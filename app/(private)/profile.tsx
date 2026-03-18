import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import ThemedText from 'Components/ThemedText';
import ThemedView from 'Components/ThemedView';

const ProfileRedirect = () => {
    useEffect(() => {
        router.replace('/account');
    }, []);

    return (
        <ThemedView safe padded>
            <ThemedText variant="title">Redirecting...</ThemedText>
            <ActivityIndicator style={{ marginTop: 10 }} />
        </ThemedView>
    );
};

export default ProfileRedirect;
