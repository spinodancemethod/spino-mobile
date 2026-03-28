import React, { useState } from 'react';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import ThemedSearch from 'Components/ThemedSearch';
import Spacer from 'Components/Spacer';
import { signUp } from 'lib/auth';
import { useTheme } from 'constants/useTheme';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const { colors } = useTheme();

    const onSignup = async () => {
        // client-side validation
        let ok = true;
        setEmailError(null);
        setPasswordError(null);
        const emailRegex = /\S+@\S+\.\S+/;
        if (!email || !emailRegex.test(email)) { setEmailError('Please enter a valid email'); ok = false; }
        if (!password || password.length < 8) { setPasswordError('Password must be at least 8 characters'); ok = false; }
        if (!ok) return;
        setLoading(true);
        try {
            const res = await signUp(email, password);
            if (!res?.error) router.replace('/');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView padded safe style={{ paddingHorizontal: 24 }}>
            <ThemedText variant="title">Create account</ThemedText>
            <Spacer />
            <ThemedText variant="small">Sign up to get started.</ThemedText>

            <Spacer />

            <ThemedSearch placeholder="Email" value={email} onChangeText={(t) => { setEmail(t); setEmailError(null); }} keyboardType="email-address" autoCapitalize="none" />
            {emailError ? <ThemedText variant="small" style={{ color: colors.warning }}>{emailError}</ThemedText> : null}
            <Spacer />
            <ThemedSearch placeholder="Password" value={password} onChangeText={(t) => { setPassword(t); setPasswordError(null); }} secureTextEntry />
            {passwordError ? <ThemedText variant="small" style={{ color: colors.warning }}>{passwordError}</ThemedText> : null}

            <Spacer />
            <ThemedButton title="Create account" onPress={onSignup} loading={loading} />

            <Spacer />
            <ThemedText variant="small">Already have an account?</ThemedText>
            <ThemedButton title="Log in" variant="ghost" onPress={() => router.push('/login')} />
        </ThemedView>
    );
}
