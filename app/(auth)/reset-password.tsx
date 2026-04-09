import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import ThemedButton from 'Components/ThemedButton';
import ThemedSearch from 'Components/ThemedSearch';
import Spacer from 'Components/Spacer';
import { updatePassword, useAuth } from 'lib/auth';
import { useTheme } from 'constants/useTheme';
import { reportAppEvent } from 'lib/observability';

export default function ResetPassword() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const hasTrackedStartRef = useRef(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user?.id || hasTrackedStartRef.current) {
            return;
        }

        hasTrackedStartRef.current = true;
        void reportAppEvent({
            event: 'reset_start',
            userId: user.id,
            metadata: {
                screen: 'reset_password',
            },
        });
    }, [user?.id]);

    const onSubmit = async () => {
        let ok = true;
        setPasswordError(null);
        setConfirmPasswordError(null);

        if (!password || password.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            ok = false;
        }

        if (!confirmPassword) {
            setConfirmPasswordError('Please confirm your password');
            ok = false;
        } else if (password !== confirmPassword) {
            setConfirmPasswordError('Passwords do not match');
            ok = false;
        }

        if (!ok) return;

        setLoading(true);
        try {
            const res = await updatePassword(password);
            if (!res?.error) {
                void reportAppEvent({
                    event: 'reset_success',
                    userId: user?.id,
                    metadata: {
                        screen: 'reset_password',
                    },
                });
                // Route to home because the user is already in a recovery session.
                router.replace('/home');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <ThemedView padded safe style={{ paddingHorizontal: 24 }}>
                <ThemedText variant="title">Reset password</ThemedText>
                <Spacer />
                <ThemedText variant="small">
                    This reset link is invalid or expired. Please request a new reset email.
                </ThemedText>
                <Spacer />
                <ThemedButton title="Request new reset email" onPress={() => router.replace('/forgot-password')} />
                <Spacer />
                <ThemedButton title="Back to login" variant="ghost" onPress={() => router.replace('/login')} />
            </ThemedView>
        );
    }

    return (
        <ThemedView padded safe style={{ paddingHorizontal: 24 }}>
            <ThemedText variant="title">Set new password</ThemedText>
            <Spacer />
            <ThemedText variant="small">
                Choose a new password for your account.
            </ThemedText>

            <Spacer />

            <ThemedSearch
                placeholder="New password"
                value={password}
                onChangeText={(t) => {
                    setPassword(t);
                    setPasswordError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
            />
            {passwordError ? <ThemedText variant="small" style={{ color: colors.warning }}>{passwordError}</ThemedText> : null}

            <Spacer />

            <ThemedSearch
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={(t) => {
                    setConfirmPassword(t);
                    setConfirmPasswordError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
            />
            {confirmPasswordError ? <ThemedText variant="small" style={{ color: colors.warning }}>{confirmPasswordError}</ThemedText> : null}

            <Spacer />
            <ThemedButton title="Update password" onPress={onSubmit} loading={loading} />
        </ThemedView>
    );
}
