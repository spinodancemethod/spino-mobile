import React, { useState } from 'react';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import ThemedSearch from 'Components/ThemedSearch';
import Spacer from 'Components/Spacer';
import { signIn } from 'lib/auth';
import { useTheme } from 'constants/useTheme';
import { getSupabaseConfigDiagnostics } from 'lib/runtimeConfig';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const { colors } = useTheme();
    const diagnostics = getSupabaseConfigDiagnostics();

    const onLogin = async () => {
        // client-side validation
        let ok = true;
        setEmailError(null);
        setPasswordError(null);
        setLoginError(null);
        const emailRegex = /\S+@\S+\.\S+/;
        if (!email || !emailRegex.test(email)) { setEmailError('Please enter a valid email'); ok = false; }
        if (!password || password.length < 8) { setPasswordError('Password must be at least 8 characters'); ok = false; }
        if (!ok) return;
        setLoading(true);
        try {
            const result = await signIn(email, password);
            if (result.error) {
                setLoginError(result.error instanceof Error ? result.error.message : String(result.error));
            }
            // AuthRouteRedirect navigates once the signed-in user state is committed.
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView padded safe style={{ paddingHorizontal: 24 }}>
            <ThemedText variant="title">Log in</ThemedText>
            <Spacer />
            <ThemedText variant="small">Welcome back — please sign in to continue.</ThemedText>

            <Spacer />

            <ThemedSearch placeholder="Email" value={email} onChangeText={(t) => { setEmail(t); setEmailError(null); }} keyboardType="email-address" autoCapitalize="none" />
            {emailError ? <ThemedText variant="small" style={{ color: colors.warning }}>{emailError}</ThemedText> : null}
            <Spacer />
            <ThemedSearch placeholder="Password" value={password} onChangeText={(t) => { setPassword(t); setPasswordError(null); }} secureTextEntry />
            {passwordError ? <ThemedText variant="small" style={{ color: colors.warning }}>{passwordError}</ThemedText> : null}

            <Spacer />
            <ThemedButton title="Log in" onPress={onLogin} loading={loading} />

            <ThemedText variant="small" style={{ marginTop: 12, color: colors.warning }}>
                {loginError ? `Login error: ${loginError}` : 'Connection diagnostics'}
            </ThemedText>
            <ThemedText variant="small">
                Host: {diagnostics.host ?? 'missing'}{`\n`}
                URL source: {diagnostics.urlSource}{`\n`}
                API key: {diagnostics.keyPresent ? `present (${diagnostics.keyLength} chars)` : 'MISSING'}{`\n`}
                Key source: {diagnostics.keySource}{`\n`}
                Platform: {diagnostics.platform}; ownership: {diagnostics.appOwnership}{`\n`}
                Runtime: {diagnostics.runtimeVersion ?? 'unknown'}
            </ThemedText>

            <Spacer />
            <ThemedButton title="Forgot password" variant="ghost" onPress={() => router.push('/forgot-password')} />
            <Spacer />
            <ThemedText variant="small">Don't have an account?</ThemedText>
            <ThemedButton title="Sign up" variant="ghost" onPress={() => router.push('/signup')} />
            {/* dev-only shortcut removed */}
        </ThemedView>
    );
}
