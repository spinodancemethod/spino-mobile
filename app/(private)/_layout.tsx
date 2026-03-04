import React, { useEffect } from 'react';
import AppContent from './AppContent';
import { useAuth, signOut } from 'lib/auth';
import { ActivityIndicator } from 'react-native';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import Spacer from 'Components/Spacer';
import { router } from 'expo-router';
import { supabase } from 'lib/supabase';
import { showSnack } from 'lib/snackbarService';

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

    // Email verification gate
    const emailConfirmed = Boolean((user as any)?.email_confirmed_at);
    if (!emailConfirmed) {
        const onCheck = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                const confirmed = Boolean((data?.session?.user as any)?.email_confirmed_at);
                if (confirmed) {
                    showSnack('Email confirmed — thanks!');
                    router.replace('/home');
                } else {
                    showSnack('Email not confirmed yet. Check your inbox and click the confirmation link.');
                }
            } catch (e: any) {
                showSnack(e?.message ?? 'Failed to check confirmation');
            }
        };

        return (
            <ThemedView padded safe>
                <ThemedText variant="title">Confirm your email</ThemedText>
                <ThemedText variant="small">We sent a confirmation link to your email. Please follow that link to verify your account before continuing.</ThemedText>
                <Spacer />
                <ThemedButton title="I confirmed — check again" onPress={onCheck} />
                <Spacer />
                <ThemedButton title="Sign out" variant="ghost" onPress={async () => { await signOut(); router.replace('/login'); }} />
            </ThemedView>
        );
    }

    return <AppContent />;
};

export default RootLayout;