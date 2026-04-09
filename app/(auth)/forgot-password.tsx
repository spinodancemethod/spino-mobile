import React, { useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import ThemedSearch from 'Components/ThemedSearch';
import Spacer from 'Components/Spacer';
import { supabase } from 'lib/supabase';
import { showSnack } from 'lib/snackbarService';
import { useTheme } from 'constants/useTheme';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const { colors } = useTheme();

    function getResetRedirectTo() {
        const override = process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_TO?.trim();
        if (override) {
            return override;
        }

        // Expo Go cannot claim custom schemes like "spino://" reliably, so use
        // an Expo URL during local testing and the app scheme for dev/prod builds.
        if (Constants.appOwnership === 'expo') {
            return Linking.createURL('reset-password');
        }

        const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'spino';
        // Use a path-based deep link so Expo Router resolves `/reset-password`
        // instead of treating `reset-password` as a URL host segment.
        return `${scheme}:///reset-password`;
    }

    const onReset = async () => {
        setEmailError(null);
        const emailRegex = /\S+@\S+\.\S+/;
        if (!email || !emailRegex.test(email)) { setEmailError('Please enter a valid email'); return; }
        setLoading(true);
        try {
            const redirectTo = getResetRedirectTo();
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });
            if (error) {
                showSnack(error.message);
            } else {
                showSnack('If the email exists, a reset link has been sent.');
                router.push('/login');
            }
        } catch (e: any) {
            showSnack(e?.message ?? 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView padded safe style={{ paddingHorizontal: 24 }}>
            <ThemedText variant="title">Reset password</ThemedText>
            <Spacer />
            <ThemedText variant="small">Enter your email and we'll send a reset link.</ThemedText>

            <Spacer />

            <ThemedSearch placeholder="Email" value={email} onChangeText={(t) => { setEmail(t); setEmailError(null); }} keyboardType="email-address" autoCapitalize="none" />
            {emailError ? <ThemedText variant="small" style={{ color: colors.warning }}>{emailError}</ThemedText> : null}

            <Spacer />
            <ThemedButton title="Send reset email" onPress={onReset} loading={loading} />

            <Spacer />
            <ThemedButton title="Back to login" variant="ghost" onPress={() => router.push('/login')} />
        </ThemedView>
    );
}
