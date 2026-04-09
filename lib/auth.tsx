import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Linking, AppState, Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { showSnack } from 'lib/snackbarService';
import { isRecoveryAuthUrl, shouldHandleAuthUrl } from 'lib/authUrl';
import { reportAppError } from 'lib/observability';
import { clearRevenueCatAppUser, syncRevenueCatAppUser } from 'lib/billing/revenuecat';

type LegacyAuthLinkResult = {
    error?: { message?: string | null } | null;
};

type AuthContextValue = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    processingLink?: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingLink, setProcessingLink] = useState(false);
    const pendingRecoveryRef = useRef(false);

    useEffect(() => {
        let mounted = true;

        async function readSessionWithRefreshFallback() {
            const { data } = await supabase.auth.getSession();
            let nextSession = data?.session ?? null;

            // If an access token expired while the app was backgrounded, attempt one
            // refresh pass before treating the user as signed out.
            if (!nextSession) {
                const { data: refreshed } = await supabase.auth.refreshSession();
                nextSession = refreshed?.session ?? null;
            }

            return nextSession;
        }

        async function init() {
            try {
                const nextSession = await readSessionWithRefreshFallback();
                if (!mounted) return;
                setSession(nextSession);
                setUser(nextSession?.user ?? null);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        init();

        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session ?? null);
            setUser(session?.user ?? null);

            // Keep RevenueCat identity aligned with Supabase auth so purchases
            // resolve to the same customer id across app restarts and devices.
            if (session?.user?.id) {
                void syncRevenueCatAppUser(session.user.id);
            }

            // navigate on important transitions
            if (event === 'SIGNED_OUT') {
                void clearRevenueCatAppUser();
                router.replace('/login');
            }
            if (event === 'PASSWORD_RECOVERY') {
                pendingRecoveryRef.current = false;
                router.replace('/reset-password');
                return;
            }
            if (event === 'SIGNED_IN') {
                if (pendingRecoveryRef.current) {
                    pendingRecoveryRef.current = false;
                    router.replace('/reset-password');
                    return;
                }
                router.replace('/home');
            }
        });

        // deep link / magic link handling
        async function handleUrl(url?: string | null) {
            if (!url) return;
            if (!shouldHandleAuthUrl(url)) return;
            // Keep recovery routing sticky until auth state event fires.
            if (isRecoveryAuthUrl(url)) {
                pendingRecoveryRef.current = true;
            }
            setProcessingLink(true);
            // small delay to ensure overlay is visible for very fast responses
            const start = Date.now();
            try {
                // prefer legacy helper if present in the current runtime
                const authWithLegacy = supabase.auth as typeof supabase.auth & {
                    getSessionFromUrl?: (params?: { url?: string }) => Promise<LegacyAuthLinkResult>;
                };

                if (typeof authWithLegacy.getSessionFromUrl === 'function') {
                    // some implementations accept an object with url, others read from current location
                    // try both common signatures
                    const res = await authWithLegacy.getSessionFromUrl({ url });
                    // if no error, session will be stored and onAuthStateChange will fire
                    if (res?.error) {
                        showSnack(res.error.message || 'Failed to handle auth link');
                    }
                    return;
                }

                // fallback: parse fragment/query for access_token & refresh_token
                const hashIdx = url.indexOf('#');
                const query = hashIdx >= 0 ? url.slice(hashIdx + 1) : (url.split('?')[1] ?? '');
                const params = new URLSearchParams(query);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (error) showSnack(error.message);
                }
            } catch (e: any) {
                showSnack(e?.message ?? 'Failed to process auth link');
                void reportAppError({
                    context: 'auth.handleUrl',
                    error: e,
                    metadata: { url },
                });
            } finally {
                const elapsed = Date.now() - start;
                const min = 600;
                if (elapsed < min) await new Promise((r) => setTimeout(r, min - elapsed));
                setProcessingLink(false);
            }
        }

        // handle cold start link
        Linking.getInitialURL().then((u) => { handleUrl(u); }).catch(() => { /* ignore */ });

        // listen for links while app is running
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

        // re-check session when app comes to foreground (helps catch refresh failures)
        const appStateHandler = (next: string) => {
            if (next === 'active') {
                // revalidate session
                readSessionWithRefreshFallback().then((nextSession) => {
                    setSession(nextSession);
                    setUser(nextSession?.user ?? null);
                    if (!nextSession) {
                        // if session is still unavailable after refresh, notify user.
                        showSnack('Session expired, please sign in again');
                    }
                }).catch(() => { /* ignore */ });
            }
        };

        const appStateSub = AppState.addEventListener('change', appStateHandler);

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe();
            try { subscription.remove(); } catch (e) { /* ignore */ }
            try { appStateSub.remove(); } catch (e) { /* ignore */ }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ session, user, loading, processingLink }}>
            {children}
            {processingLink ? (
                <Modal transparent visible animationType="fade">
                    <View style={styles.overlay} pointerEvents="box-none">
                        <View style={styles.box}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.text}>Signing you in…</Text>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </AuthContext.Provider>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    box: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontWeight: '700',
        marginTop: 12,
    },
});

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export default AuthProvider;

export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showSnack(error.message || 'Error signing out');
            void reportAppError({
                context: 'auth.signOut',
                error,
            });
            return { error };
        }
        showSnack('Signed out successfully');
        return { error: null };
    } catch (e: any) {
        showSnack(e?.message ?? 'Error signing out');
        void reportAppError({
            context: 'auth.signOut',
            error: e,
        });
        return { error: e };
    }
}

export async function signIn(email: string, password: string) {
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showSnack(error.message || 'Login failed');
            void reportAppError({
                context: 'auth.signIn',
                error,
                metadata: { email },
            });
            return { error };
        }
        showSnack('Logged in');
        return { error: null };
    } catch (e: any) {
        showSnack(e?.message ?? 'Login failed');
        void reportAppError({
            context: 'auth.signIn',
            error: e,
            metadata: { email },
        });
        return { error: e };
    }
}

export async function signUp(email: string, password: string) {
    try {
        const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'spino';
        const redirectTo = `${scheme}://login`;
        // include redirectTo so confirmation/magic links return to the app
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: redirectTo,
            },
        });
        if (error) {
            showSnack(error.message || 'Signup failed');
            void reportAppError({
                context: 'auth.signUp',
                error,
                metadata: { email },
            });
            return { error };
        }
        showSnack('Signup successful. Check your email to confirm.');
        return { error: null, data };
    } catch (e: any) {
        showSnack(e?.message ?? 'Signup failed');
        void reportAppError({
            context: 'auth.signUp',
            error: e,
            metadata: { email },
        });
        return { error: e };
    }
}

export async function signInWithOAuth(provider: 'google' | 'apple') {
    try {
        const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'spino';
        const redirectTo = `${scheme}://login`;
        const res = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo },
        });
        if (res?.error) {
            showSnack(res.error.message || 'OAuth sign-in failed');
            void reportAppError({
                context: 'auth.signInWithOAuth',
                error: res.error,
                metadata: { provider },
            });
            return { error: res.error };
        }
        return { error: null, data: res?.data };
    } catch (e: any) {
        showSnack(e?.message ?? 'OAuth sign-in failed');
        void reportAppError({
            context: 'auth.signInWithOAuth',
            error: e,
            metadata: { provider },
        });
        return { error: e };
    }
}

export async function updatePassword(password: string) {
    try {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) {
            showSnack(error.message || 'Failed to update password');
            void reportAppError({
                context: 'auth.updatePassword',
                error,
            });
            return { error };
        }
        showSnack('Password updated successfully');
        return { error: null, data };
    } catch (e: any) {
        showSnack(e?.message ?? 'Failed to update password');
        void reportAppError({
            context: 'auth.updatePassword',
            error: e,
        });
        return { error: e };
    }
}
