import React, { useState } from 'react';
import { router } from 'expo-router';
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

    const onReset = async () => {
        setEmailError(null);
        const emailRegex = /\S+@\S+\.\S+/;
        if (!email || !emailRegex.test(email)) { setEmailError('Please enter a valid email'); return; }
        setLoading(true);
        try {
            const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'spino';
            const redirectTo = `${scheme}://login`;
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
        <ThemedView padded safe>
            <ThemedText variant="title">Reset password</ThemedText>
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
